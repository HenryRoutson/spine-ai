import { createBrowserClient } from "@supabase/ssr";

// AI : browser-side Supabase — the publishable key is RLS-guarded and safe to ship;
// AI : NEXT_PUBLIC_* values are inlined at build time (root .env symlinked as .env.local).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
