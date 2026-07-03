#!/usr/bin/env node
// AI : validate MODEL_CATALOG slugs against OpenRouter /api/v1/models and print live rates.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: join(root, ".env") });

const MARKUP = 1.4;

const CATALOG = [
  { id: "qwen-2.5-72b", slug: "qwen/qwen-2.5-72b-instruct" },
  { id: "deepseek-v3", slug: "deepseek/deepseek-chat" },
  { id: "glm-5.2", slug: "z-ai/glm-5.2" },
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

let ok = true;
for (const { id, slug } of CATALOG) {
  const row = byId.get(slug);
  if (!row?.pricing?.prompt || !row.pricing.completion) {
    console.error(`pricing missing for ${id} → ${slug}`);
    ok = false;
    continue;
  }
  const prompt = Number(row.pricing.prompt);
  const completion = Number(row.pricing.completion);
  const cost = blended(prompt, completion);
  console.log(`${id}: ${slug} → ${cost}¢/1k (OpenRouter +40%)`);
}

if (!ok) process.exit(1);
console.log("All catalog slugs have live OpenRouter pricing — runtime fetch via GET /api/state");
