import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { getSupabaseConfig } from "./config.js";

// AI : node scripts — no session persistence/refresh; every client is short-lived.
// AI : ws transport: Node 20 has no native WebSocket and supabase-js inits realtime eagerly
// AI : (we never subscribe); drop once on Node >= 22.
const clientOpts = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
};

export function adminClient(): SupabaseClient {
  const c = getSupabaseConfig();
  return createClient(c.url, c.serviceRoleKey, clientOpts);
}

// AI : create-if-missing with a pre-confirmed email, so signIn works without touching the
// AI : dashboard's "Confirm email" setting. In the real app this is replaced by the normal
// AI : supabase.auth.signUp flow from the frontend.
export async function ensureUser(admin: SupabaseClient, email: string, password: string): Promise<void> {
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error && error.code !== "email_exists") throw error;
}

// AI : the per-user client IS the security boundary — its JWT makes postgres RLS scope
// AI : every query to that user's rows. No user_id filtering anywhere in app code.
export async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const c = getSupabaseConfig();
  const client = createClient(c.url, c.anonKey, clientOpts);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}
