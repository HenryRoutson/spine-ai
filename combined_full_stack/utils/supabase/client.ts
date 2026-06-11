import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupabasePublicEnv } from "@/utils/supabase/env";

declare global {
  interface Window {
    __SUPABASE_PUBLIC__?: SupabasePublicEnv;
  }
}

let cachedEnv: SupabasePublicEnv | null = null;
let cachedClient: SupabaseClient | null = null;
let envPromise: Promise<SupabasePublicEnv> | null = null;

function envFromWindow(): SupabasePublicEnv | null {
  if (typeof window === "undefined") return null;
  const injected = window.__SUPABASE_PUBLIC__;
  if (!injected?.url || !injected?.key) return null;
  return injected;
}

function envFromBuild(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url: url as SupabasePublicEnv["url"], key: key as SupabasePublicEnv["key"] };
}

async function fetchPublicEnv(): Promise<SupabasePublicEnv> {
  const res = await fetch("/api/supabase-env", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY on Vercel, then redeploy.",
    );
  }
  const env = (await res.json()) as SupabasePublicEnv;
  if (typeof window !== "undefined") window.__SUPABASE_PUBLIC__ = env;
  return env;
}

async function resolvePublicEnv(): Promise<SupabasePublicEnv> {
  if (cachedEnv) return cachedEnv;
  const sync = envFromWindow() ?? envFromBuild();
  if (sync) {
    cachedEnv = sync;
    return sync;
  }
  if (!envPromise) envPromise = fetchPublicEnv().then((env) => { cachedEnv = env; return env; });
  return envPromise;
}

// AI : browser-side Supabase — config from injected script, build-time env, or /api/supabase-env.
export async function createClient(): Promise<SupabaseClient> {
  if (cachedClient) return cachedClient;
  const { url, key } = await resolvePublicEnv();
  cachedClient = createBrowserClient(url, key);
  return cachedClient;
}
