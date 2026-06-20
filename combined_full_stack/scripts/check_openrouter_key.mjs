#!/usr/bin/env node
// AI : /models is public — auth/key is the real inference-key check.
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: join(appRoot, ".env.local") });
config({ path: join(appRoot, "../.env") });

const key = process.env.OPENROUTER_API_KEY?.trim();
if (!key) {
  console.error("OPENROUTER_API_KEY missing — set a regular inference key in the repo root .env");
  process.exit(1);
}

const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
  headers: { Authorization: `Bearer ${key}` },
});
const body = await res.text();

if (!res.ok) {
  if (res.status === 401 && body.includes("User not found")) {
    console.error(
      "OPENROUTER_API_KEY cannot run inference (401 User not found).\n" +
        "Create a regular API key at https://openrouter.ai/settings/keys\n" +
        "(not a Management/Provisioning key from the Management API Keys page).",
    );
  } else {
    console.error(`OpenRouter auth/key ${res.status}: ${body}`);
  }
  process.exit(1);
}

const info = JSON.parse(body);
console.log("OpenRouter inference key OK", {
  label: info.data?.label,
  limit: info.data?.limit,
  usage: info.data?.usage,
});
