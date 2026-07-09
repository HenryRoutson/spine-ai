import { NextResponse } from "next/server";
import { AUTH_SIGN_IN_REQUIRED } from "@/lib/auth-messages";
import { createClient } from "@/utils/supabase/server";
import { getSupabasePublicEnv } from "@/utils/supabase/env";

export type user_id_string = string & { __brand: "user_id" };

export type AuthSession = {
  userId: user_id_string;
  email: string | undefined;
};

// AI : shared local-dev identity — job ownership, billing, and JsonStore all use this key.
export const LOCAL_DEV_USER_ID = "local-dev" as user_id_string;

const MISCONFIGURED =
  "Server misconfigured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY on Vercel";

export function isVercelWithoutSupabase(): boolean {
  return !!process.env.VERCEL && !getSupabasePublicEnv();
}

export function isProductionDeploy(): boolean {
  return !!process.env.VERCEL || !!getSupabasePublicEnv();
}

// AI : local JsonStore + shared dev identity — never on Vercel or NODE_ENV=production.
export function isLocalDevMode(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.VERCEL;
}

function emailFromClaims(claims: Record<string, unknown> | undefined): string | undefined {
  if (!claims) return undefined;
  const email = claims.email;
  return typeof email === "string" ? email : undefined;
}

async function sessionFromClaims(): Promise<AuthSession | null> {
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;
  return {
    userId: sub as user_id_string,
    email: emailFromClaims(data.claims as Record<string, unknown> | undefined),
  };
}

// AI : optional session for shared-link runs — record who was signed in without requiring auth.
export async function optionalAuthSession(): Promise<AuthSession | null> {
  if (isVercelWithoutSupabase()) return null;
  // AI : never fabricate local-dev identity here — anonymous viewers must stay anonymous.
  try {
    return await sessionFromClaims();
  } catch {
    return null;
  }
}

// AI : production + Supabase-configured deploys require a signed-in session — no shared anon store.
export async function requireAuth(): Promise<AuthSession | NextResponse> {
  if (isVercelWithoutSupabase()) {
    return NextResponse.json({ error: MISCONFIGURED }, { status: 503 });
  }

  if (isLocalDevMode()) {
    try {
      const session = await sessionFromClaims();
      if (session) return session;
    } catch {
      /* local dev without Supabase */
    }
    // AI : SECURITY — shared JsonStore identity only for true local-dev without Supabase.
    // AI : isLocalDevMode() already excludes Vercel; never mint LOCAL_DEV_USER_ID when public env is set.
    if (!getSupabasePublicEnv()) {
      return { userId: LOCAL_DEV_USER_ID, email: undefined };
    }
  }

  if (!isProductionDeploy()) {
    return NextResponse.json({ error: AUTH_SIGN_IN_REQUIRED }, { status: 401 });
  }

  try {
    const session = await sessionFromClaims();
    if (session) return session;
  } catch {
    /* fall through */
  }
  return NextResponse.json({ error: AUTH_SIGN_IN_REQUIRED }, { status: 401 });
}

export function isAuthSession(v: AuthSession | NextResponse): v is AuthSession {
  return !(v instanceof NextResponse);
}
