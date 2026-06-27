import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/utils/supabase/env";

// AI : service-role client for cross-user store access on shared-link runs.
export function getServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
}

export async function createAdminClient(): Promise<SupabaseClient | null> {
  const env = getSupabasePublicEnv();
  const serviceKey = getServiceRoleKey();
  if (!env || !serviceKey) return null;
  return createClient(env.url, serviceKey, { auth: { persistSession: false } });
}
