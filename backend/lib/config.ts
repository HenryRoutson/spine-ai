import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// AI : .env lives at repo root, two levels above backend/lib/
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../.env") });

type OpenRouterApiKey = string & { __brand: "OpenRouterApiKey" };
type DataDir = string & { __brand: "DataDir" };

interface Config {
  openRouterApiKey: OpenRouterApiKey;
  dataDir: DataDir; // local JSON persistence root (swap to Supabase later)
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
    dataDir: resolve(here, "../data") as DataDir,
  };
  return cached;
}

// AI : the data dir is needed even when no API key is set (offline store/tests).
export function dataDir(): string {
  return resolve(here, "../data");
}

export const REPO_ROOT = resolve(here, "../..");
export const DOCUMENTS_DIR = resolve(REPO_ROOT, "documents");
