import { loadEnvOnce } from "./load_env";

export type supabase_url_string = string & { __brand: "supabase_url" };

export type SupabasePublicEnv = {
  url: supabase_url_string;
};

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  loadEnvOnce();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!url) return null;
  return { url: url as supabase_url_string };
}

export function getServiceRoleKey(): string | undefined {
  loadEnvOnce();
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
}
