import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getSupabasePublicEnv } from "@/utils/supabase/env";

export type user_id_string = string & { __brand: "user_id" };

export type AuthSession = {
  userId: user_id_string;
  email: string | undefined;
};

const MISCONFIGURED =
  "Server misconfigured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY on Vercel";

export function isVercelWithoutSupabase(): boolean {
  return !!process.env.VERCEL && !getSupabasePublicEnv();
}

export function isProductionDeploy(): boolean {
  return !!process.env.VERCEL || !!getSupabasePublicEnv();
}

// AI : production + Supabase-configured deploys require a signed-in session — no shared anon store.
export async function requireAuth(): Promise<AuthSession | NextResponse> {
  if (isVercelWithoutSupabase()) {
    return NextResponse.json({ error: MISCONFIGURED }, { status: 503 });
  }

  if (!isProductionDeploy()) {
    const db = await createClient().catch(() => null);
    if (!db) return { userId: "local-dev" as user_id_string, email: undefined };
    const { data } = await db.auth.getUser();
    if (data.user?.id) {
      return { userId: data.user.id as user_id_string, email: data.user.email ?? undefined };
    }
    return { userId: "local-dev" as user_id_string, email: undefined };
  }

  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  return { userId: data.user.id as user_id_string, email: data.user.email ?? undefined };
}

export function isAuthSession(v: AuthSession | NextResponse): v is AuthSession {
  return !(v instanceof NextResponse);
}
