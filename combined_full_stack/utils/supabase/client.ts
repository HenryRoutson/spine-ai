import { createBrowserClient } from "@supabase/ssr";
import type { SupabasePublicEnv } from "@/utils/supabase/env";

declare global {
  interface Window {
    __SUPABASE_PUBLIC__?: SupabasePublicEnv;
  }
}

function resolvePublicEnv(): SupabasePublicEnv {
  const injected = typeof window !== "undefined" ? window.__SUPABASE_PUBLIC__ : undefined;
  const url = injected?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = injected?.key ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY on Vercel, then redeploy.",
    );
  }
  return { url: url as SupabasePublicEnv["url"], key: key as SupabasePublicEnv["key"] };
}

// AI : browser-side Supabase — publishable key is RLS-guarded; config comes from build-time
// AI : NEXT_PUBLIC_* or window.__SUPABASE_PUBLIC__ injected by the server layout.
export function createClient() {
  const { url, key } = resolvePublicEnv();
  return createBrowserClient(url, key);
}
