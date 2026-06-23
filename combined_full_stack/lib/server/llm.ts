import { type ZodType } from "zod";
import {
  getStringResponse,
  getStructuredResponse,
  getStructuredResponsesParallel,
  type ChatOptions,
} from "./openrouter_llm";
import { type ServerLogger } from "./server_logger";
import { type LlmCallRecord, type ModelId, slugFor } from "./types";
import { type UsageLedger } from "./usage";

// AI : single place to call the LLM with a demo ModelId — maps id→slug and bills the ledger.
// AI : mirrors the pitch's "Get llm instance" idea (one cached entry point for all calls).
interface CallContext {
  model: ModelId;
  ledger: UsageLedger;
  system?: string;
  llmCalls?: LlmCallRecord[];
}

function chatOpts(ctx: CallContext, log?: ServerLogger): ChatOptions {
  return {
    // AI : the demo ModelId maps to a real OpenRouter slug; both are branded strings.
    model: slugFor(ctx.model) as unknown as ChatOptions["model"],
    system: ctx.system,
    onUsage: (u) => {
      log?.info(`token usage`, { model: ctx.model, ...u });
      ctx.ledger.recordLlm({ model: ctx.model, ...u });
    },
    onRoundTrip: (inputChars, outputChars, ok, latencyMs) => {
      ctx.llmCalls?.push({
        inputChars,
        outputChars,
        latencyMs,
        status: ok ? "ok" : "error",
      });
    },
  };
}

export function llmString(prompt: string, ctx: CallContext): Promise<string> {
  return getStringResponse(prompt, chatOpts(ctx));
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
