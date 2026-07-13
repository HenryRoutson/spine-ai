// AI : provider-agnostic structured response API — Zod validation, streaming, parallel batch.
import { type ZodType } from "zod";
import { structuredLlmPrompt } from "../structure";
import { FailureKind } from "../types";
import { type ServerLogger, logger } from "../server_logger";
import { getLlmProvider } from "./registry";
import {
  type LlmCallOptions,
  type LlmProvider,
  type LlmTransportOptions,
  type RawReply,
  type VisionAttachment,
} from "./types";

export type { LlmCallOptions as ChatOptions, VisionAttachment, RawReply };
export type { RawUsage, ParallelChatResult } from "./types";
export type ModelSlug = import("../openrouter_http").ModelSlug;

const llmLog = logger("llm");

export class StructuredResponseError extends Error {
  readonly rawJson?: string;

  constructor(message: string, rawJson?: string) {
    super(message);
    this.name = "StructuredResponseError";
    this.rawJson = rawJson;
  }
}

function resolveCall(opts: LlmCallOptions): {
  provider: LlmProvider;
  transport: LlmTransportOptions;
} {
  if (!opts.providerId || !opts.providerModel) {
    throw new Error("LlmCallOptions requires providerId and providerModel — set via catalogEntry(modelId)");
  }
  return {
    provider: getLlmProvider(opts.providerId),
    transport: opts as LlmTransportOptions,
  };
}

function extractJson(raw: RawReply): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.search(/[{[]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  return start !== -1 && end > start ? body.slice(start, end + 1) : body;
}

type StructuredParseFail = { ok: false; kind: Extract<FailureKind, "json_parse" | "schema">; error: string };

function parseStructured<T>(raw: RawReply, schema: ZodType<T>): { ok: true; data: T } | StructuredParseFail {
  const json = extractJson(raw);
  try {
    const parsed = JSON.parse(json);
    const result = schema.safeParse(parsed);
    if (result.success) return { ok: true, data: result.data };
    return { ok: false, kind: FailureKind.Schema, error: result.error.toString() };
  } catch (e) {
    return { ok: false, kind: FailureKind.JsonParse, error: (e as Error).message };
  }
}

export async function getStringResponse(prompt: string, opts: LlmCallOptions = {}): Promise<string> {
  const { provider, transport } = resolveCall(opts);
  return provider.chat(prompt, transport, false);
}

export async function streamStringResponse(
  prompt: string,
  onDelta: (delta: string) => void,
  opts: LlmCallOptions = {},
  log: ServerLogger = llmLog,
): Promise<string> {
  const { provider, transport } = resolveCall(opts);
  if (!provider.streamTextChat) throw new Error(`${provider.id} does not support streaming`);
  return provider.streamTextChat(prompt, transport, onDelta, log);
}

export async function streamStructuredResponse<T>(
  prompt: string,
  schema: ZodType<T>,
  onRawDelta: (delta: string) => void,
  opts: LlmCallOptions = {},
  log: ServerLogger = llmLog,
): Promise<T> {
  const { provider, transport } = resolveCall(opts);
  if (!provider.fetchStreamingChat) {
    log.warn(`provider lacks streaming — falling back to non-stream structured`, { provider: provider.id });
    return getStructuredResponse(prompt, schema, opts, log);
  }
  const base = structuredLlmPrompt(prompt, schema);
  log.info(`stream structured request`, { provider: provider.id, promptChars: base.length });
  const raw = await provider.fetchStreamingChat(base, transport, onRawDelta, log, true);
  const parsed = parseStructured(raw, schema);
  if (parsed.ok) {
    log.info(`stream structured parse ok`, { provider: provider.id, replyChars: raw.length });
    return parsed.data;
  }
  log.warn(`stream structured parse failed — retrying non-stream`, { kind: parsed.kind });
  opts.onStructuredFailure?.({
    kind: parsed.kind,
    error: parsed.error,
    attempt: 1,
    promptIndex: opts.promptIndex,
    round: opts.round ?? 0,
    inputChars: base.length,
    replyChars: raw.length,
    willRetry: true,
  });
  return getStructuredResponse(prompt, schema, { ...opts, round: (opts.round ?? 0) + 1 }, log);
}

export async function getVisionStringResponse(
  prompt: string,
  attachments: readonly VisionAttachment[],
  opts: LlmCallOptions = {},
): Promise<string> {
  const { provider, transport } = resolveCall(opts);
  if (!provider.visionChat) throw new Error(`${provider.id} does not support vision`);
  return provider.visionChat(prompt, attachments, transport, false);
}

export async function getStructuredResponse<T>(
  prompt: string,
  schema: ZodType<T>,
  opts: LlmCallOptions = {},
  log: ServerLogger = llmLog,
): Promise<T> {
  const { provider, transport } = resolveCall(opts);
  const base = structuredLlmPrompt(prompt, schema);
  let lastError = "";
  let lastFailureKind: Extract<FailureKind, "json_parse" | "schema"> | undefined;
  let lastRaw = "";
  const roundBase = opts.round ?? 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const willRetry = attempt < 1;
    const round = roundBase + attempt;
    const attemptOpts: LlmTransportOptions = { ...transport, round };
    log.debug(`structured attempt`, { attempt: attempt + 1, correcting: attempt > 0, round, provider: provider.id });
    const ask =
      attempt === 0
        ? base
        : `${base}\n\nYour previous reply failed validation:\n${lastError}\nReturn corrected JSON only.`;
    const raw = await provider.chat(ask, attemptOpts, true, log);
    lastRaw = extractJson(raw);
    const parsed = parseStructured(raw, schema);
    if (parsed.ok) {
      if (attempt > 0 && lastFailureKind) {
        log.info(`llm ${lastFailureKind === "json_parse" ? "json parse" : "schema validation"} recovered`, {
          attempt: attempt + 1,
          priorFailureKind: lastFailureKind,
        });
      } else {
        log.info(`structured parse ok`, { attempt: attempt + 1 });
      }
      return parsed.data;
    }
    lastFailureKind = parsed.kind;
    lastError = parsed.error;
    const logMsg = parsed.kind === "json_parse" ? "llm json parse failed" : "llm schema validation failed";
    log.warn(willRetry ? `${logMsg} — will retry` : logMsg, {
      failureKind: parsed.kind,
      attempt: attempt + 1,
      detail: lastError.slice(0, 500),
    });
    opts.onStructuredFailure?.({
      kind: parsed.kind,
      error: lastError,
      attempt: attempt + 1,
      promptIndex: opts.promptIndex,
      round,
      inputChars: ask.length,
      replyChars: raw.length,
      willRetry,
    });
  }
  log.error(`llm structured output failed after retry`, {
    failureKind: lastFailureKind,
    detail: lastError.slice(0, 500),
  });
  throw new StructuredResponseError(`structured response failed validation after retry:\n${lastError}`, lastRaw || undefined);
}

export async function getStructuredResponsesParallel<T>(
  prompts: string[],
  schema: ZodType<T>,
  opts: LlmCallOptions = {},
  log: ServerLogger = llmLog,
): Promise<T[]> {
  if (prompts.length === 0) return [];
  if (prompts.length === 1) return [await getStructuredResponse(prompts[0], schema, opts, log)];

  const { provider, transport } = resolveCall(opts);
  const bases = prompts.map((p) => structuredLlmPrompt(p, schema));
  const parallel = provider.parallelChat ?? null;
  const raws = parallel
    ? await parallel(bases, { ...transport, round: opts.round ?? 0 }, true, log)
    : await Promise.all(
        bases.map(async (base, index) => ({
          index,
          content: await provider.chat(base, { ...transport, promptIndex: index, round: opts.round ?? 0 }, true, log),
          latencyMs: 0,
        })),
      );

  const out: T[] = new Array(prompts.length);
  const retry: number[] = [];

  for (const { index, content } of raws) {
    const parsed = parseStructured(content, schema);
    if (parsed.ok) out[index] = parsed.data;
    else {
      retry.push(index);
      opts.onStructuredFailure?.({
        kind: parsed.kind,
        error: parsed.error,
        attempt: 1,
        promptIndex: index,
        round: opts.round ?? 0,
        inputChars: bases[index]!.length,
        replyChars: content.length,
        willRetry: true,
      });
    }
  }

  await Promise.all(
    retry.map(async (index) => {
      log.warn(`parallel item retry`, { index, total: prompts.length });
      out[index] = await getStructuredResponse(prompts[index]!, schema, {
        ...opts,
        promptIndex: index,
        round: (opts.round ?? 0) + 1,
      }, log);
    }),
  );

  log.info(`getStructuredResponsesParallel complete`, { count: prompts.length, retried: retry.length });
  return out;
}
