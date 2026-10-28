export type supabase_url_string = string & { __brand: "supabase_url" };
export type supabase_key_string = string & { __brand: "supabase_key" };

export type SupabasePublicEnv = {
  url: supabase_url_string;
  key: supabase_key_string;
};

// AI : one resolver for all Supabase clients — Vercel may use SUPABASE_* at runtime while
// AI : NEXT_PUBLIC_* must be present at build time for client bundles.
export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) return null;
  return { url: url as supabase_url_string, key: key as supabase_key_string };
}
