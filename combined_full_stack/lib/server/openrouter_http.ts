// AI : HTTP transport layer for OpenRouter — slot limiting, retry, connection pooling, body builders.
// AI : Consumed by openrouter_llm.ts (structured response API). Keep free of Zod / schema logic.
import { Agent, fetch as undiciFetch, type Dispatcher } from "undici";
import { FailureKind } from "./types";
import { type ServerLogger, logger } from "./server_logger";
import { DEEPSEEK_SLUG, OPENROUTER_AUTH_KEY_URL, OPENROUTER_CHAT_URL } from "./openrouter_slugs";
import "./config";

const orLog = logger("openrouter");

type ApiKey = string & { __brand: "OpenRouterApiKey" };
export type ModelSlug = string & { __brand: "ModelSlug" };
export type RawReply = string & { __brand: "RawReply" };
type JsonModeOn = boolean;
type HttpStatus = number;
type RetryAfterSeconds = number;

export const DEFAULT_MODEL = DEEPSEEK_SLUG as ModelSlug;

export type ParallelStrategy = "http1-burst" | "http1-pooled";

// AI : macOS/Linux — burst wins (scripts/benchmark_parallel_openrouter.mjs). Windows ~64 socket cap → pool.
export function defaultParallelStrategy(): ParallelStrategy {
  return process.platform === "win32" ? "http1-pooled" : "http1-burst";
}

// AI : /models is public — only /auth/key proves the key can run inference (not mgmt/provisioning).
let inferenceKeyCheck: Promise<void> | null = null;

// AI : raw OpenRouter token counts, surfaced so callers can bill per call.
export interface RawUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ChatOptions {
  model?: ModelSlug;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  promptIndex?: number;
  round?: number;
  onUsage?: (usage: RawUsage) => void;
  // AI : fired after every HTTP round-trip (ok or failed) for length + latency distributions.
  onRoundTrip?: (
    inputChars: number,
    outputChars: number,
    ok: boolean,
    latencyMs: number,
    meta?: {
      attempt: number;
      promptIndex?: number;
      round?: number;
      httpStatus?: number;
      willRetry?: boolean;
      failureKind?: FailureKind;
      failureDetail?: string;
    },
  ) => void;
  // AI : HTTP succeeded but JSON/schema validation failed on the reply body.
  onStructuredFailure?: (detail: {
    kind: Extract<FailureKind, "json_parse" | "schema">;
    error: string;
    attempt: number;
    promptIndex?: number;
    round?: number;
    inputChars: number;
    replyChars: number;
    willRetry: boolean;
  }) => void;
}

export interface ParallelChatResult {
  index: number;
  content: RawReply;
  latencyMs: number;
}

// AI : bug fix — without an explicit cap OpenRouter reserves the model's max output (64k for
// AI : Anthropic) against the account balance and 402s; 8k is plenty for every step we run.
export const DEFAULT_MAX_TOKENS = 8192;

// AI : single pipeline steps only — llm-batch bypasses this via parallelChat.
const MAX_IN_FLIGHT = 2;
let inFlight = 0;
const slotWaiters: (() => void)[] = [];

export async function acquireOpenRouterSlot(log = orLog): Promise<() => void> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++;
    log.debug(`slot acquired immediately`, { inFlight, max: MAX_IN_FLIGHT });
    return () => {
      inFlight--;
      log.debug(`slot released`, { inFlight, waiters: slotWaiters.length });
      slotWaiters.shift()?.();
    };
  }
  log.info(`slot queue — waiting`, { inFlight, waiters: slotWaiters.length + 1 });
  await new Promise<void>((resolve) => slotWaiters.push(resolve));
  inFlight++;
  log.debug(`slot acquired from queue`, { inFlight });
  return () => {
    inFlight--;
    log.debug(`slot released`, { inFlight, waiters: slotWaiters.length });
    slotWaiters.shift()?.();
  };
}

const RETRYABLE_STATUSES = new Set<HttpStatus>([429, 502, 503, 529]);
const MAX_CHAT_ATTEMPTS = 6;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30000;
const POOLED_CONNECTIONS = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(res: Response, attempt: number): number {
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter) as RetryAfterSeconds;
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  }
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt);
}

function apiKey(): ApiKey {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY missing — set it in the repo root .env");
  return key as ApiKey;
}

function openRouterAuthError(status: HttpStatus, body: string): Error {
  if (status === 401 && body.includes("User not found")) {
    return new Error(
      "OpenRouter 401: inference key required — OPENROUTER_API_KEY is missing, revoked, or a Management/Provisioning key. " +
        "Create a regular API key at https://openrouter.ai/settings/keys (not Management API Keys) and set it in the repo root .env, then restart the dev server.",
    );
  }
  return new Error(`OpenRouter ${status}: ${body}`);
}

export async function assertInferenceKey(log = orLog): Promise<void> {
  if (!inferenceKeyCheck) {
    inferenceKeyCheck = (async () => {
      const res = await fetch(OPENROUTER_AUTH_KEY_URL, {
        headers: { Authorization: `Bearer ${apiKey()}` },
      });
      if (res.ok) {
        log.debug(`inference key validated`);
        return;
      }
      const body = await res.text();
      log.error(`inference key rejected`, { status: res.status, bodyPreview: body.slice(0, 200) });
      throw openRouterAuthError(res.status, body);
    })();
  }
  return inferenceKeyCheck;
}

function openRouterHeaders(key: ApiKey): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    // AI : optional attribution — OpenRouter docs recommend these for app discovery.
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
    "X-Title": process.env.OPENROUTER_APP_TITLE ?? "forge",
  };
}

// AI : response slug may differ (deepseek-chat → deepseek-chat-v3) but must stay same model family.
export function assertResponseModel(responseModel: string, requested: ModelSlug): void {
  const family = requested.split("/")[0].toLowerCase();
  if (!responseModel.toLowerCase().startsWith(`${family}/`)) {
    throw new Error(`model mismatch: requested ${requested}, got ${responseModel}`);
  }
}

// AI : multimodal attachments for doc-to-text vision OCR (images, PDF scans, handwriting).
export type VisionAttachment = {
  mime: string;
  base64: string;
};

type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | VisionUserContent[] };

type VisionUserContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function buildMessagesBody(messages: ChatMessage[], opts: ChatOptions, jsonMode: JsonModeOn, stream = false): string {
  const payload = [
    ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
    ...messages,
  ];
  return JSON.stringify({
    model: opts.model ?? DEFAULT_MODEL,
    messages: payload,
    temperature: opts.temperature ?? 0,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    provider: { allow_fallbacks: false },
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
  });
}

function buildChatBody(prompt: string, opts: ChatOptions, jsonMode: JsonModeOn, stream = false): string {
  return buildMessagesBody([{ role: "user", content: prompt }], opts, jsonMode, stream);
}

function buildVisionChatBody(
  prompt: string,
  attachments: readonly VisionAttachment[],
  opts: ChatOptions,
  jsonMode: JsonModeOn,
): string {
  const content: VisionUserContent[] = [{ type: "text", text: prompt }];
  for (const a of attachments) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${a.mime};base64,${a.base64}` },
    });
  }
  return buildMessagesBody([{ role: "user", content }], opts, jsonMode);
}

async function httpPost(
  body: string,
  dispatcher?: Dispatcher,
): Promise<{ res: Response; latencyMs: number }> {
  const t0 = Date.now();
  const res = dispatcher
    ? await undiciFetch(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers: openRouterHeaders(apiKey()),
        body,
        dispatcher,
      })
    : await fetch(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers: openRouterHeaders(apiKey()),
        body,
      });
  return { res: res as unknown as Response, latencyMs: Date.now() - t0 };
}

// AI : attach promptIndex/round from opts so llm-batch retry grids can place each HTTP attempt.
function roundTripMeta(
  opts: ChatOptions,
  extra: {
    attempt: number;
    httpStatus?: number;
    willRetry?: boolean;
    failureKind?: FailureKind;
    failureDetail?: string;
  },
) {
  return { ...extra, promptIndex: opts.promptIndex, round: opts.round };
}

async function fetchChat(
  body: string,
  inputChars: number,
  opts: ChatOptions,
  log: ServerLogger,
  dispatcher?: Dispatcher,
): Promise<RawReply> {
  const model = opts.model ?? DEFAULT_MODEL;
  let lastError = "";
  for (let attempt = 0; attempt < MAX_CHAT_ATTEMPTS; attempt++) {
    log.debug(`fetch attempt`, { attempt: attempt + 1, max: MAX_CHAT_ATTEMPTS });
    const { res, latencyMs } = await httpPost(body, dispatcher);
    if (!res.ok) {
      lastError = await res.text();
      const willRetry = RETRYABLE_STATUSES.has(res.status) && attempt < MAX_CHAT_ATTEMPTS - 1;
      const failureDetail = `HTTP ${res.status}: ${lastError.slice(0, 500)}`;
      log.warn(willRetry ? `llm provider error — will retry` : `llm provider error`, {
        failureKind: "provider",
        status: res.status,
        attempt: attempt + 1,
        maxAttempts: MAX_CHAT_ATTEMPTS,
        detail: failureDetail.slice(0, 300),
      });
      opts.onRoundTrip?.(inputChars, 0, false, latencyMs, roundTripMeta(opts, {
        attempt: attempt + 1,
        httpStatus: res.status,
        willRetry,
        failureKind: FailureKind.Provider,
        failureDetail,
      }));
      if (willRetry) {
        const delayMs = retryDelayMs(res, attempt);
        log.info(`llm provider retry scheduled`, {
          attempt: attempt + 2,
          delayMs,
          reason: `HTTP ${res.status}`,
        });
        await sleep(delayMs);
        continue;
      }
      throw openRouterAuthError(res.status, lastError);
    }
    const data = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    if (data.model) assertResponseModel(data.model, model);
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      const failureDetail = "OpenRouter returned no message content";
      opts.onRoundTrip?.(inputChars, 0, false, latencyMs, roundTripMeta(opts, {
        attempt: attempt + 1,
        failureKind: FailureKind.Provider,
        failureDetail,
      }));
      log.error(`llm provider error`, { failureKind: "provider", attempt: attempt + 1, detail: failureDetail });
      throw new Error(failureDetail);
    }
    opts.onUsage?.({
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    });
    opts.onRoundTrip?.(inputChars, content.length, true, latencyMs, roundTripMeta(opts, { attempt: attempt + 1 }));
    if (attempt > 0) {
      log.info(`llm provider recovered`, {
        model,
        attempt: attempt + 1,
        priorFailures: attempt,
        failureKind: "provider",
      });
    } else {
      log.info(`chat success`, { model, replyChars: content.length, attempt: attempt + 1 });
    }
    return content as RawReply;
  }
  const failureDetail = `OpenRouter failed after ${MAX_CHAT_ATTEMPTS} attempts: ${lastError.slice(0, 500)}`;
  opts.onRoundTrip?.(inputChars, 0, false, 0, roundTripMeta(opts, {
    attempt: MAX_CHAT_ATTEMPTS,
    failureKind: FailureKind.Provider,
    failureDetail,
  }));
  log.error(`llm provider error`, { failureKind: "provider", attempt: MAX_CHAT_ATTEMPTS, detail: failureDetail.slice(0, 300) });
  throw new Error(failureDetail);
}

async function fetchTextChat(
  prompt: string,
  opts: ChatOptions,
  jsonMode: JsonModeOn,
  log: ServerLogger,
  dispatcher?: Dispatcher,
): Promise<RawReply> {
  return fetchChat(buildChatBody(prompt, opts, jsonMode), prompt.length, opts, log, dispatcher);
}

async function fetchVisionChat(
  prompt: string,
  attachments: readonly VisionAttachment[],
  opts: ChatOptions,
  jsonMode: JsonModeOn,
  log: ServerLogger,
  dispatcher?: Dispatcher,
): Promise<RawReply> {
  const inputChars = prompt.length + attachments.reduce((n, a) => n + a.base64.length, 0);
  return fetchChat(buildVisionChatBody(prompt, attachments, opts, jsonMode), inputChars, opts, log, dispatcher);
}

// AI : single low-level call; jsonMode forces the model into strict json output
export async function chat(prompt: string, opts: ChatOptions, jsonMode: JsonModeOn, log = orLog): Promise<RawReply> {
  await assertInferenceKey(log);
  const model = opts.model ?? DEFAULT_MODEL;
  log.info(`chat request`, {
    model,
    jsonMode,
    promptChars: prompt.length,
    temperature: opts.temperature ?? 0,
    maxTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
  });
  const release = await acquireOpenRouterSlot(log);
  try {
    return await fetchTextChat(prompt, opts, jsonMode, log);
  } finally {
    release();
  }
}

// AI : vision OCR path — images/PDFs attached as base64 data URLs (doc-to-text LLM mode).
export async function visionChat(
  prompt: string,
  attachments: readonly VisionAttachment[],
  opts: ChatOptions,
  jsonMode: JsonModeOn,
  log = orLog,
): Promise<RawReply> {
  await assertInferenceKey(log);
  const model = opts.model ?? DEFAULT_MODEL;
  log.info(`vision chat request`, {
    model,
    jsonMode,
    promptChars: prompt.length,
    attachments: attachments.length,
    temperature: opts.temperature ?? 0,
    maxTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
  });
  const release = await acquireOpenRouterSlot(log);
  try {
    return await fetchVisionChat(prompt, attachments, opts, jsonMode, log);
  } finally {
    release();
  }
}

// AI : fire N prompts at once — http1-burst on macOS/Linux, pooled on Windows; skips slot limiter.
export async function parallelChat(
  prompts: readonly string[],
  opts: ChatOptions = {},
  jsonMode: JsonModeOn = false,
  log: ServerLogger = orLog,
  strategy: ParallelStrategy = defaultParallelStrategy(),
): Promise<ParallelChatResult[]> {
  await assertInferenceKey(log);
  const model = opts.model ?? DEFAULT_MODEL;
  log.info(`parallelChat`, { count: prompts.length, model, jsonMode, strategy });

  let dispatcher: Dispatcher | undefined;
  if (strategy === "http1-pooled") {
    dispatcher = new Agent({ connections: POOLED_CONNECTIONS, pipelining: 1 });
  }

  try {
    return Promise.all(
      prompts.map(async (prompt, index) => {
        const t0 = Date.now();
        const itemOpts: ChatOptions = {
          ...opts,
          promptIndex: index,
          round: opts.round ?? 0,
        };
        const content = await fetchTextChat(prompt, itemOpts, jsonMode, log, dispatcher);
        return { index, content, latencyMs: Date.now() - t0 };
      }),
    );
  } finally {
    if (dispatcher instanceof Agent) await dispatcher.close();
  }
}

// AI : exported for streamStructuredResponse in openrouter_llm.ts which needs slot + streaming.
export async function fetchStreamingChat(
  prompt: string,
  opts: ChatOptions,
  onDelta: (delta: string) => void,
  log: ServerLogger,
  jsonMode: JsonModeOn = false,
): Promise<RawReply> {
  const model = opts.model ?? DEFAULT_MODEL;
  const body = buildChatBody(prompt, opts, jsonMode, true);
  const inputChars = prompt.length;
  let lastError = "";

  for (let attempt = 0; attempt < MAX_CHAT_ATTEMPTS; attempt++) {
    log.debug(`stream attempt`, { attempt: attempt + 1, max: MAX_CHAT_ATTEMPTS });
    const t0 = Date.now();
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: openRouterHeaders(apiKey()),
      body,
    });
    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      lastError = await res.text();
      const willRetry = RETRYABLE_STATUSES.has(res.status) && attempt < MAX_CHAT_ATTEMPTS - 1;
      opts.onRoundTrip?.(inputChars, 0, false, latencyMs, roundTripMeta(opts, {
        attempt: attempt + 1,
        httpStatus: res.status,
        willRetry,
        failureKind: FailureKind.Provider,
        failureDetail: `HTTP ${res.status}: ${lastError.slice(0, 500)}`,
      }));
      if (willRetry) {
        await sleep(retryDelayMs(res, attempt));
        continue;
      }
      throw openRouterAuthError(res.status, lastError);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("OpenRouter stream returned no body");

    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    let responseModel: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as {
            model?: string;
            choices?: { delta?: { content?: string } }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          if (parsed.model) responseModel = parsed.model;
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) {
            full += delta;
            onDelta(delta);
          }
          if (parsed.usage) {
            opts.onUsage?.({
              promptTokens: parsed.usage.prompt_tokens ?? 0,
              completionTokens: parsed.usage.completion_tokens ?? 0,
            });
          }
        } catch {
          // AI : skip malformed SSE lines
        }
      }
    }

    if (responseModel) assertResponseModel(responseModel, model);
    opts.onRoundTrip?.(inputChars, full.length, true, latencyMs, roundTripMeta(opts, { attempt: attempt + 1 }));
    log.info(`stream success`, { model, replyChars: full.length, attempt: attempt + 1 });
    return full as RawReply;
  }

  throw new Error(`OpenRouter stream failed after ${MAX_CHAT_ATTEMPTS} attempts: ${lastError.slice(0, 500)}`);
}

export async function streamTextChat(
  prompt: string,
  opts: ChatOptions,
  onDelta: (delta: string) => void,
  log: ServerLogger,
): Promise<RawReply> {
  await assertInferenceKey(log);
  const model = opts.model ?? DEFAULT_MODEL;
  log.info(`stream request`, { model, promptChars: prompt.length });
  const release = await acquireOpenRouterSlot(log);
  try {
    return await fetchStreamingChat(prompt, opts, onDelta, log);
  } finally {
    release();
  }
}
