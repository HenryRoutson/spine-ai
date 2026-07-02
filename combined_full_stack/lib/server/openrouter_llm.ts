// AI : structured response API over OpenRouter — Zod schema validation, streaming, parallel batch.
// AI : HTTP transport lives in openrouter_http.ts; this file is the public facade.
import { type ZodType } from "zod";
import { structuredLlmPrompt } from "./structure";
import { type FailureKind } from "./types";
import { type ServerLogger, logger } from "./server_logger";
import {
  acquireOpenRouterSlot,
  assertInferenceKey,
  chat,
  visionChat,
  streamTextChat,
  parallelChat,
  fetchStreamingChat,
  DEFAULT_MODEL,
  type RawReply,
  type ChatOptions,
  type VisionAttachment,
  type RawUsage,
  type ParallelStrategy,
  type ParallelChatResult,
  type ModelSlug,
  assertResponseModel,
  defaultParallelStrategy,
} from "./openrouter_http";

export type {
  ChatOptions,
  VisionAttachment,
  RawUsage,
  ParallelStrategy,
  ParallelChatResult,
  ModelSlug,
};
export { assertResponseModel, defaultParallelStrategy, parallelChat };

const orLog = logger("openrouter");

// AI : thrown when structured LLM output fails parse/validation — carries last raw reply for logging.
export class StructuredResponseError extends Error {
  readonly rawJson?: string;

  constructor(message: string, rawJson?: string) {
    super(message);
    this.name = "StructuredResponseError";
    this.rawJson = rawJson;
  }
}

// AI : pull the first json value out of a possibly fenced / chatty reply
function extractJson(raw: RawReply): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.search(/[{[]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  return start !== -1 && end > start ? body.slice(start, end + 1) : body;
}

type StructuredParseFail = { ok: false; kind: Extract<FailureKind, "json_parse" | "schema">; error: string };

function parseStructured<T>(
  raw: RawReply,
  schema: ZodType<T>,
): { ok: true; data: T } | StructuredParseFail {
  const json = extractJson(raw);
  try {
    const parsed = JSON.parse(json);
    const result = schema.safeParse(parsed);
    if (result.success) return { ok: true, data: result.data };
    return { ok: false, kind: "schema", error: result.error.toString() };
  } catch (e) {
    return { ok: false, kind: "json_parse", error: (e as Error).message };
  }
}

export async function getStringResponse(prompt: string, opts: ChatOptions = {}): Promise<string> {
  return chat(prompt, opts, false);
}

export async function streamStringResponse(
  prompt: string,
  onDelta: (delta: string) => void,
  opts: ChatOptions = {},
  log: ServerLogger = orLog,
): Promise<string> {
  return streamTextChat(prompt, opts, onDelta, log);
}

// AI : stream a structured response — emits raw JSON deltas for live preview, parses full text at end.
// AI : on parse failure falls back to getStructuredResponse (non-streaming retry).
export async function streamStructuredResponse<T>(
  prompt: string,
  schema: ZodType<T>,
  onRawDelta: (delta: string) => void,
  opts: ChatOptions = {},
  log: ServerLogger = orLog,
): Promise<T> {
  await assertInferenceKey(log);
  const model = opts.model ?? DEFAULT_MODEL;
  const base = structuredLlmPrompt(prompt, schema);
  log.info(`stream structured request`, { model, promptChars: base.length });
  const release = await acquireOpenRouterSlot(log);
  let raw: RawReply;
  try {
    raw = await fetchStreamingChat(base, opts, onRawDelta, log, true);
  } finally {
    release();
  }
  const parsed = parseStructured(raw, schema);
  if (parsed.ok) {
    log.info(`stream structured parse ok`, { model, replyChars: raw.length });
    return parsed.data;
  }
  // AI : fall back to non-streaming retry on parse failure — acquires its own slot.
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
  opts: ChatOptions = {},
): Promise<string> {
  return visionChat(prompt, attachments, opts, false);
}

// AI : formatted response validated against a zod schema, with one self-correcting retry
export async function getStructuredResponse<T>(
  prompt: string,
  schema: ZodType<T>,
  opts: ChatOptions = {},
  log: ServerLogger = orLog,
): Promise<T> {
  const base = structuredLlmPrompt(prompt, schema);
  let lastError = "";
  let lastFailureKind: Extract<FailureKind, "json_parse" | "schema"> | undefined;
  let lastRaw = "";
  const roundBase = opts.round ?? 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const willRetry = attempt < 1;
    const round = roundBase + attempt;
    const attemptOpts: ChatOptions = { ...opts, round };
    log.debug(`structured attempt`, { attempt: attempt + 1, correcting: attempt > 0, round });
    const ask =
      attempt === 0
        ? base
        : `${base}\n\nYour previous reply failed validation:\n${lastError}\nReturn corrected JSON only.`;
    const raw = await chat(ask, attemptOpts, true, log);
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
    const logMsg =
      parsed.kind === "json_parse" ? "llm json parse failed" : "llm schema validation failed";
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

// AI : llm-batch path — all items in one parallel burst, per-item retry via getStructuredResponse on failure.
export async function getStructuredResponsesParallel<T>(
  prompts: string[],
  schema: ZodType<T>,
  opts: ChatOptions = {},
  log: ServerLogger = orLog,
): Promise<T[]> {
  if (prompts.length === 0) return [];
  if (prompts.length === 1) return [await getStructuredResponse(prompts[0], schema, opts, log)];

  const bases = prompts.map((p) => structuredLlmPrompt(p, schema));
  const raws = await parallelChat(bases, { ...opts, round: opts.round ?? 0 }, true, log);
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
