import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/utils/supabase/env";

// AI : per-request Supabase client built from the session cookies — its JWT makes
// AI : postgres RLS scope every query to the signed-in user (the whole multi-tenancy).
export async function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) throw new Error("Supabase env missing — set NEXT_PUBLIC_SUPABASE_URL and key on Vercel");
  const cookieStore = await cookies();
  return createServerClient(
    env.url,
    env.key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, _headers) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // AI : called from a Server Component — proxy handles session refresh there.
          }
        },
      },
    },
  );
}
