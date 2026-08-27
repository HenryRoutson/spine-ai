import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { API_ROUTES } from "@/lib/api-routes";
import { FETCH_NO_STORE } from "@/lib/api-client";
import type { SupabasePublicEnv } from "@/utils/supabase/env";

declare global {
  interface Window {
    __SUPABASE_PUBLIC__?: SupabasePublicEnv;
  }
}

let cachedEnv: SupabasePublicEnv | null = null;
let cachedClient: SupabaseClient | null = null;
let envPromise: Promise<SupabasePublicEnv | null> | null = null;

function envFromWindow(): SupabasePublicEnv | null {
  if (typeof window === "undefined") return null;
  const injected = window.__SUPABASE_PUBLIC__;
  if (!injected?.url || !injected?.key) return null;
  return injected;
}

function envFromBuild(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url: url as SupabasePublicEnv["url"], key: key as SupabasePublicEnv["key"] };
}

const SUPABASE_MISSING =
  "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY on Vercel, then redeploy.";

async function fetchPublicEnv(): Promise<SupabasePublicEnv | null> {
  const res = await fetch(API_ROUTES.supabaseEnv, FETCH_NO_STORE);
  if (!res.ok) return null;
  const env = (await res.json()) as SupabasePublicEnv;
  if (!env?.url || !env?.key) return null;
  if (typeof window !== "undefined") window.__SUPABASE_PUBLIC__ = env;
  return env;
}

async function resolvePublicEnv(): Promise<SupabasePublicEnv | null> {
  if (cachedEnv) return cachedEnv;
  const sync = envFromWindow() ?? envFromBuild();
  if (sync) {
    cachedEnv = sync;
    return sync;
  }
  if (!envPromise) envPromise = fetchPublicEnv().then((env) => { if (env) cachedEnv = env; return env; });
  return envPromise;
}

// AI : local JsonStore has no public Supabase env — callers that can run unsigned must use this.
export async function tryCreateClient(): Promise<SupabaseClient | null> {
  if (cachedClient) return cachedClient;
  const env = await resolvePublicEnv();
  if (!env) return null;
  cachedClient = createBrowserClient(env.url, env.key);
  return cachedClient;
}

// AI : browser-side Supabase — config from injected script, build-time env, or /api/supabase-env.
export async function createClient(): Promise<SupabaseClient> {
  const client = await tryCreateClient();
  if (!client) throw new Error(SUPABASE_MISSING);
  return client;
}
