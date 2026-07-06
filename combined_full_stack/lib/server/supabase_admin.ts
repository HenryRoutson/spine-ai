import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import ws from "ws";
import { getSupabasePublicEnv } from "@/utils/supabase/env";

// AI : service-role client for cross-user store access on shared-link runs.
export function getServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
}

export async function createAdminClient(): Promise<SupabaseClient | null> {
  const env = getSupabasePublicEnv();
  const serviceKey = getServiceRoleKey();
  if (!env || !serviceKey) return null;
  return createClient(env.url, serviceKey, {
    auth: { persistSession: false },
    // AI : Node 20 has no native WebSocket — ws transport required for @supabase/supabase-js init.
    realtime: { transport: ws as unknown as WebSocketLikeConstructor },
  });
}
