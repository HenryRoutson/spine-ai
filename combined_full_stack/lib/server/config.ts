import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// AI : import.meta.url breaks once Next bundles this into .next/server — anchor on the
// AI : app root (process.cwd() === combined_full_stack/ under `next dev`/`next start`).
// AI : .env lives at repo root, one level above; .env.local in-app wins if present.
const here = process.cwd();
loadEnv({ path: resolve(here, ".env.local") });
loadEnv({ path: resolve(here, "../.env") });

type OpenRouterApiKey = string & { __brand: "OpenRouterApiKey" };
type DataDir = string & { __brand: "DataDir" };

interface Config {
  openRouterApiKey: OpenRouterApiKey;
  llmProviderId: string;
  dataDir: DataDir;
}

// AI : fail early if a required env var is missing (pitch: "raise errors early").
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} missing — set it in the repo root .env`);
  return value;
}

let cached: Config | null = null;

export function getConfig(): Config {
  if (cached) return cached;
  cached = {
    openRouterApiKey: requireEnv("OPENROUTER_API_KEY") as OpenRouterApiKey,
    llmProviderId: process.env.LLM_PROVIDER?.trim() || "openrouter",
    dataDir: dataDir() as DataDir,
  };
  return cached;
}

// AI : the data dir is needed even when no API key is set (offline store/tests).
// AI : Vercel fs is read-only outside /tmp (todo §8) — artifacts become ephemeral there.
export function dataDir(): string {
  return process.env.VERCEL ? "/tmp/forge_data" : resolve(here, "data");
}

export const REPO_ROOT = resolve(here, "..");

// AI : canonical seed docs live under combined_full_stack/documents/ (bundled on Vercel).
// AI : monorepo dev falls back to repo-root documents/ only when the in-app folder is absent.
function documentsDir(): string {
  const inApp = resolve(here, "documents");
  if (process.env.VERCEL || existsSync(inApp)) return inApp;
  return resolve(REPO_ROOT, "documents");
}

export const DOCUMENTS_DIR = documentsDir();
