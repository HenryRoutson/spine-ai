import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

let loaded = false;

// AI : repo root .env is canonical — same keys as combined_full_stack.
export function loadEnvOnce(): void {
  if (loaded) return;
  loaded = true;
  const here = process.cwd();
  loadEnv({ path: resolve(here, ".env.local") });
  loadEnv({ path: resolve(here, "../.env") });
}

export const REPO_ROOT = resolve(process.cwd(), "..");
export const APP_DATA_DIR = resolve(REPO_ROOT, "combined_full_stack/data");
