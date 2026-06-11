#!/usr/bin/env node
// AI : refresh MODEL_OPTIONS rates from OpenRouter /api/v1/models (40% markup baked into costPer1k).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: join(root, ".env") });

const MARKUP = 1.4;
const TYPES_PATH = join(dirname(fileURLToPath(import.meta.url)), "../lib/server/types.ts");

const CATALOG = [
  { id: "qwen-2.5-72b", slug: "qwen/qwen-2.5-72b-instruct" },
  { id: "deepseek-v3", slug: "deepseek/deepseek-chat" },
  { id: "glm-4-plus", slug: "z-ai/glm-4.6" },
  { id: "gpt-5-mini", slug: "openai/gpt-4o-mini" },
  { id: "claude-opus-4.6", slug: "anthropic/claude-opus-4.1" },
  { id: "sonnet-4.7", slug: "anthropic/claude-sonnet-4.5" },
  { id: "gemini-3-flash", slug: "google/gemini-3-flash-preview" },
];

function blended(prompt, completion) {
  return +((prompt + completion) * 1000 * 100 * MARKUP).toFixed(4);
}

const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error("OPENROUTER_API_KEY missing in repo root .env");
  process.exit(1);
}

const res = await fetch("https://openrouter.ai/api/v1/models", {
  headers: { Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error(`OpenRouter models ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const { data } = await res.json();
const byId = new Map(data.map((m) => [m.id, m]));

let src = readFileSync(TYPES_PATH, "utf8");
const start = src.indexOf("export const MODEL_OPTIONS");
const end = src.indexOf("];", start) + 2;
if (start === -1 || end === 1) {
  console.error("MODEL_OPTIONS block not found in types.ts");
  process.exit(1);
}

const lines = ["export const MODEL_OPTIONS: ModelOption[] = ["];
for (const { id, slug } of CATALOG) {
  const row = byId.get(slug);
  if (!row?.pricing?.prompt || !row.pricing.completion) {
    console.error(`pricing missing for ${slug}`);
    process.exit(1);
  }
  const prompt = Number(row.pricing.prompt);
  const completion = Number(row.pricing.completion);
  const cost = blended(prompt, completion);
  const meta = {
    "qwen-2.5-72b": { label: "Qwen 2.5 72B", provider: "openrouter", flag: "CN", cheap: true },
    "deepseek-v3": { label: "DeepSeek V3", provider: "openrouter", flag: "CN", cheap: true },
    "glm-4-plus": { label: "GLM-4 Plus", provider: "openrouter", flag: "CN", cheap: true },
    "gpt-5-mini": { label: "GPT-5 mini", provider: "openai", flag: "US" },
    "claude-opus-4.6": { label: "Claude Opus 4.6", provider: "anthropic", flag: "US" },
    "sonnet-4.7": { label: "Claude Sonnet 4.7", provider: "anthropic", flag: "US" },
    "gemini-3-flash": { label: "Gemini 3 Flash", provider: "google", flag: "US" },
  }[id];
  const cheap = meta.cheap ? ", cheap: true" : "";
  lines.push(
    `  { id: "${id}", label: "${meta.label}", provider: "${meta.provider}", flag: "${meta.flag}", costPer1k: ${cost}, promptUsdPerToken: ${prompt}, completionUsdPerToken: ${completion}${cheap}, slug: "${slug}" as OpenRouterSlug },`,
  );
  console.log(`${id}: ${slug} → ${cost}¢/1k (OpenRouter +40%)`);
}
lines.push("];");

src = src.slice(0, start) + lines.join("\n") + src.slice(end);
writeFileSync(TYPES_PATH, src);
console.log("Updated lib/server/types.ts");
