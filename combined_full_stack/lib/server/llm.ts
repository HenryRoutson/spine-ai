// AI : facade over openrouter_llm — keep thin when openrouter_llm.ts splits transport vs parse.
import { type ZodType } from "zod";
import {
  getStringResponse,
  getStructuredResponse,
  getStructuredResponsesParallel,
  getVisionStringResponse,
  streamStringResponse,
  streamStructuredResponse,
  type ChatOptions,
  type VisionAttachment,
} from "./openrouter_llm";
import { type ServerLogger } from "./server_logger";
import { FailureKind, LlmCallStatus, type LlmCallRecord, type ModelId } from "./types";
import { slugFor } from "./model_catalog";
import { assertWithinStepCostLimit } from "./step_cost_limit";
import { type UsageLedger } from "./usage";

// AI : single place to call the LLM with a demo ModelId — maps id→slug and bills the ledger.
// AI : mirrors the pitch's "Get llm instance" idea (one cached entry point for all calls).
export interface CallContext {
  model: ModelId;
  ledger: UsageLedger;
  system?: string;
  maxTokens?: number;
  promptIndex?: number;
  round?: number;
  llmCalls?: LlmCallRecord[];
  onStructuredFailure?: ChatOptions["onStructuredFailure"];
  // AI : per-step spend cap — checked after each billed LLM call when both are set.
  costLimitCents?: number;
  stepBaseCents?: number;
  stepLabel?: string;
}

function chatOpts(ctx: CallContext, log?: ServerLogger): ChatOptions {
  return {
    // AI : the demo ModelId maps to a real OpenRouter slug; both are branded strings.
    model: slugFor(ctx.model) as unknown as ChatOptions["model"],
    system: ctx.system,
    maxTokens: ctx.maxTokens,
    promptIndex: ctx.promptIndex,
    round: ctx.round,
    onUsage: (u) => {
      log?.info(`token usage`, { model: ctx.model, ...u });
      ctx.ledger.recordLlm({ model: ctx.model, ...u });
      if (ctx.costLimitCents != null && ctx.stepBaseCents != null) {
        assertWithinStepCostLimit(ctx.ledger, ctx.stepBaseCents, ctx.costLimitCents, ctx.stepLabel);
      }
    },
    onRoundTrip: (inputChars, outputChars, ok, latencyMs, meta) => {
      ctx.llmCalls?.push({
        inputChars,
        outputChars,
        latencyMs,
        status: ok ? LlmCallStatus.Ok : LlmCallStatus.Error,
        attempt: meta?.attempt,
        promptIndex: meta?.promptIndex ?? ctx.promptIndex,
        round: meta?.round ?? ctx.round,
        httpStatus: meta?.httpStatus,
        failureKind: meta?.failureKind ?? (ok ? undefined : FailureKind.Provider),
        failureDetail: meta?.failureDetail,
      });
    },
    onStructuredFailure: (detail) => {
      ctx.llmCalls?.push({
        inputChars: detail.inputChars,
        outputChars: detail.replyChars,
        latencyMs: 0,
        status: LlmCallStatus.Error,
        attempt: detail.attempt,
        promptIndex: detail.promptIndex ?? ctx.promptIndex,
        round: detail.round ?? ctx.round ?? detail.attempt - 1,
        failureKind: detail.kind,
        failureDetail: detail.error,
      });
      ctx.onStructuredFailure?.(detail);
    },
  };
}

export function llmString(prompt: string, ctx: CallContext): Promise<string> {
  return getStringResponse(prompt, chatOpts(ctx));
}

export function llmStreamString(
  prompt: string,
  ctx: CallContext,
  onDelta: (delta: string) => void,
  log?: ServerLogger,
): Promise<string> {
  return streamStringResponse(prompt, onDelta, chatOpts(ctx, log), log);
}

export function llmVisionString(
  prompt: string,
  attachments: readonly VisionAttachment[],
  ctx: CallContext,
  log?: ServerLogger,
): Promise<string> {
  return getVisionStringResponse(prompt, attachments, chatOpts(ctx, log));
}

export function llmStructured<T>(
  prompt: string,
  schema: ZodType<T>,
  ctx: CallContext,
  log?: ServerLogger,
): Promise<T> {
  log?.debug(`llmStructured call`, { model: ctx.model, promptChars: prompt.length });
  return getStructuredResponse(prompt, schema, chatOpts(ctx, log), log);
}

// AI : like llmStructured but streams the raw JSON response — onRawDelta fires on each token.
export function llmStreamStructured<T>(
  prompt: string,
  schema: ZodType<T>,
  ctx: CallContext,
  onRawDelta: (delta: string) => void,
  log?: ServerLogger,
): Promise<T> {
  log?.debug(`llmStreamStructured call`, { model: ctx.model, promptChars: prompt.length });
  return streamStructuredResponse(prompt, schema, onRawDelta, chatOpts(ctx, log), log);
}

// AI : batch llm — fires all items in one http1-burst parallel round (see openrouter_llm.parallelChat).
export async function llmBatchStructured<T>(
  items: unknown[],
  promptFor: (item: unknown, index: number) => string,
  schema: ZodType<T>,
  ctx: CallContext,
  log?: ServerLogger,
  onProgress?: (current: number, total: number) => void,
): Promise<T[]> {
  log?.info(`llmBatchStructured start`, { itemCount: items.length, model: ctx.model });
  onProgress?.(0, items.length);
  const prompts = items.map((item, i) => promptFor(item, i));
  const rows = await getStructuredResponsesParallel(prompts, schema, chatOpts(ctx, log), log);
  onProgress?.(items.length, items.length);
  log?.info(`llmBatchStructured complete`, { itemCount: items.length });
  return rows;
}
