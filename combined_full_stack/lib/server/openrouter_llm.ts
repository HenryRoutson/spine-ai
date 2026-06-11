import { z, type ZodType } from "zod";
// AI : env loading is centralised in ./config (cwd-anchored) — importing it for the
// AI : side effect keeps OPENROUTER_API_KEY available here without a second dotenv path.
import "./config";

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

async function acquireOpenRouterSlot(): Promise<() => void> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++;
    return () => {
      inFlight--;
      slotWaiters.shift()?.();
    };
  }
  await new Promise<void>((resolve) => slotWaiters.push(resolve));
  inFlight++;
  return () => {
    inFlight--;
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
async function chat(prompt: string, opts: ChatOptions, jsonMode: JsonModeOn): Promise<RawReply> {
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

  const release = await acquireOpenRouterSlot();
  try {
    let lastError = "";
    for (let attempt = 0; attempt < MAX_CHAT_ATTEMPTS; attempt++) {
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
        if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_CHAT_ATTEMPTS - 1) {
          await sleep(retryDelayMs(res, attempt));
          continue;
        }
        throw new Error(`OpenRouter ${res.status}: ${lastError}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("OpenRouter returned no message content");
      opts.onUsage?.({
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      });
      return content as RawReply;
    }
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
): Promise<T> {
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema), null, 2);
  const base = `${prompt}\n\nRespond with ONLY a JSON value that validates against this JSON Schema:\n${jsonSchema}`;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const ask =
      attempt === 0
        ? base
        : `${base}\n\nYour previous reply failed validation:\n${lastError}\nReturn corrected JSON only.`;
    const raw = await chat(ask, opts, true);
    try {
      const result = schema.safeParse(JSON.parse(extractJson(raw)));
      if (result.success) return result.data;
      lastError = result.error.toString();
    } catch (e) {
      lastError = `not valid JSON: ${(e as Error).message}\nraw: ${raw}`;
    }
  }
  throw new Error(`structured response failed validation after retry:\n${lastError}`);
}
