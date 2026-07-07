import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import ws from "ws";
import { getServiceRoleKey, getSupabasePublicEnv } from "./supabase_env";

export async function createAdminClient(): Promise<SupabaseClient | null> {
  const env = getSupabasePublicEnv();
  const serviceKey = getServiceRoleKey();
  if (!env || !serviceKey) return null;
  return createClient(env.url, serviceKey, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as WebSocketLikeConstructor },
  });
}
