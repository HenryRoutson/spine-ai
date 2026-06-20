import { z, type ZodType } from "zod";
import { structuredLlmPrompt } from "./structure";
import { type ServerLogger, logger } from "./server_logger";
// AI : env loading is centralised in ./config (cwd-anchored) — importing it for the
// AI : side effect keeps OPENROUTER_API_KEY available here without a second dotenv path.
import "./config";

const orLog = logger("openrouter");

type ApiKey = string & { __brand: "OpenRouterApiKey" };
type ModelSlug = string & { __brand: "ModelSlug" };
type RawReply = string & { __brand: "RawReply" };
type JsonModeOn = boolean;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "deepseek/deepseek-chat" as ModelSlug;

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
  // AI : fired with token counts after every successful call (feeds Logging + Billing).
  onUsage?: (usage: RawUsage) => void;
  // AI : fired after every HTTP round-trip (ok or failed) for length distributions.
  onRoundTrip?: (inputChars: number, outputChars: number, ok: boolean) => void;
}

// AI : bug fix — without an explicit cap OpenRouter reserves the model's max output (64k for
// AI : Anthropic) against the account balance and 402s; 8k is plenty for every step we run.
const DEFAULT_MAX_TOKENS = 8192;

type HttpStatus = number;
type RetryAfterSeconds = number;

// AI : shared OpenRouter keys hit upstream 429s when llm-batch fires 4 parallel calls; cap in-flight.
const MAX_IN_FLIGHT = 2;
let inFlight = 0;
const slotWaiters: (() => void)[] = [];

async function acquireOpenRouterSlot(log = orLog): Promise<() => void> {
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
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY missing — set it in the repo root .env");
  return key as ApiKey;
}

// AI : single low-level call; jsonMode forces the model into strict json output
async function chat(prompt: string, opts: ChatOptions, jsonMode: JsonModeOn, log = orLog): Promise<RawReply> {
  const model = opts.model ?? DEFAULT_MODEL;
  log.info(`chat request`, {
    model,
    jsonMode,
    promptChars: prompt.length,
    temperature: opts.temperature ?? 0,
    maxTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
  });
  const messages = [
    ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
    { role: "user" as const, content: prompt },
  ];
  const body = JSON.stringify({
    model: opts.model ?? DEFAULT_MODEL,
    messages,
    temperature: opts.temperature ?? 0,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    // AI : TODO bug/risk — json_object mode formally promises an OBJECT, yet every outIsList
    // AI : schema expects a top-level ARRAY. deepseek happens to emit arrays; stricter providers
    // AI : (openai) will wrap or refuse, leaving only the extractJson + retry path.
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  });

  const release = await acquireOpenRouterSlot(log);
  try {
    let lastError = "";
    for (let attempt = 0; attempt < MAX_CHAT_ATTEMPTS; attempt++) {
      log.debug(`fetch attempt`, { attempt: attempt + 1, max: MAX_CHAT_ATTEMPTS });
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
        },
        body,
      });
      if (!res.ok) {
        lastError = await res.text();
        log.warn(`chat HTTP error`, { status: res.status, attempt: attempt + 1, bodyPreview: lastError.slice(0, 200) });
        if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_CHAT_ATTEMPTS - 1) {
          const delay = retryDelayMs(res, attempt);
          log.info(`retrying after delay`, { delayMs: delay, status: res.status });
          opts.onRoundTrip?.(prompt.length, 0, false);
          await sleep(delay);
          continue;
        }
        log.error(`chat failed permanently`, { status: res.status, attempts: attempt + 1 });
        opts.onRoundTrip?.(prompt.length, 0, false);
        throw new Error(`OpenRouter ${res.status}: ${lastError}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        log.error(`no message content in response`);
        opts.onRoundTrip?.(prompt.length, 0, false);
        throw new Error("OpenRouter returned no message content");
      }
      const usage = {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      };
      log.info(`chat success`, { model, ...usage, replyChars: content.length, attempt: attempt + 1 });
      opts.onUsage?.(usage);
      opts.onRoundTrip?.(prompt.length, content.length, true);
      return content as RawReply;
    }
    log.error(`exhausted all attempts`, { attempts: MAX_CHAT_ATTEMPTS, lastError: lastError.slice(0, 200) });
    opts.onRoundTrip?.(prompt.length, 0, false);
    throw new Error(`OpenRouter failed after ${MAX_CHAT_ATTEMPTS} attempts: ${lastError}`);
  } finally {
    release();
  }
}

// 1. plain string response from openrouter
export async function getStringResponse(prompt: string, opts: ChatOptions = {}): Promise<string> {
  return chat(prompt, opts, false);
}

// AI : pull the first json value out of a possibly fenced / chatty reply
function extractJson(raw: RawReply): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.search(/[{[]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  return start !== -1 && end > start ? body.slice(start, end + 1) : body;
}

// 2. formatted response validated against a zod schema, with one self-correcting retry
export async function getStructuredResponse<T>(
  prompt: string,
  schema: ZodType<T>,
  opts: ChatOptions = {},
  log: ServerLogger = orLog,
): Promise<T> {
  const base = structuredLlmPrompt(prompt, schema);
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    log.debug(`structured attempt`, { attempt: attempt + 1, correcting: attempt > 0 });
    const ask =
      attempt === 0
        ? base
        : `${base}\n\nYour previous reply failed validation:\n${lastError}\nReturn corrected JSON only.`;
    const raw = await chat(ask, opts, true, log);
    try {
      const result = schema.safeParse(JSON.parse(extractJson(raw)));
      if (result.success) {
        log.info(`structured parse ok`, { attempt: attempt + 1 });
        return result.data;
      }
      lastError = result.error.toString();
      log.warn(`zod validation failed`, { attempt: attempt + 1, error: lastError.slice(0, 300) });
    } catch (e) {
      lastError = `not valid JSON: ${(e as Error).message}\nraw: ${raw}`;
      log.warn(`json parse failed`, { attempt: attempt + 1, error: (e as Error).message, rawPreview: raw.slice(0, 200) });
    }
  }
  log.error(`structured response failed after retry`, { lastError: lastError.slice(0, 500) });
  throw new Error(`structured response failed validation after retry:\n${lastError}`);
}
