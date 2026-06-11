import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { z, type ZodType } from "zod";

// AI : .env lives at repo root, one level above backend/
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../.env") });

type ApiKey = string & { __brand: "OpenRouterApiKey" };
type ModelSlug = string & { __brand: "ModelSlug" };
type RawReply = string & { __brand: "RawReply" };
type JsonModeOn = boolean;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "deepseek/deepseek-chat" as ModelSlug;

export interface ChatOptions {
  model?: ModelSlug;
  system?: string;
  temperature?: number;
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
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      messages,
      temperature: opts.temperature ?? 0,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenRouter returned no message content");
  return content as RawReply;
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
