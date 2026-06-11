import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// AI : same fail-early pattern as backend/lib/config.ts; .env lives at repo root.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../.env") });

type SupabaseUrl = string & { __brand: "SupabaseUrl" };
type SupabaseAnonKey = string & { __brand: "SupabaseAnonKey" };
type SupabaseServiceRoleKey = string & { __brand: "SupabaseServiceRoleKey" };

interface SupabaseConfig {
  url: SupabaseUrl;
  anonKey: SupabaseAnonKey; // safe for browsers — RLS is the actual guard
  serviceRoleKey: SupabaseServiceRoleKey; // bypasses RLS — demo user creation only, never ship to a client
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} missing — set it in the repo root .env (see backend_with_users/README.md)`);
  return value;
}

let cached: SupabaseConfig | null = null;

export function getSupabaseConfig(): SupabaseConfig {
  if (cached) return cached;
  cached = {
    url: requireEnv("SUPABASE_URL") as SupabaseUrl,
    anonKey: requireEnv("SUPABASE_ANON_KEY") as SupabaseAnonKey,
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY") as SupabaseServiceRoleKey,
  };
  return cached;
}
