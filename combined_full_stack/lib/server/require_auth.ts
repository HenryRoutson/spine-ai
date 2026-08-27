import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { AUTH_SIGN_IN_REQUIRED } from "@/lib/auth-messages";
import { createClient } from "@/utils/supabase/server";
import { getSupabasePublicEnv } from "@/utils/supabase/env";
import { authorizationBearerToken } from "@/lib/server/bearer-token";

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
  if (process.env.VERCEL) return false
  return process.env.NODE_ENV !== "production"
}

function emailFromClaims(claims: Record<string, unknown> | undefined): string | undefined {
  if (!claims) return undefined;
  const email = claims.email;
  return typeof email === "string" ? email : undefined;
}

async function sessionFromBearer(): Promise<AuthSession | null> {
  let token = "";
  try {
    const headerList = await headers();
    token = authorizationBearerToken(headerList) ?? "";
  } catch {
    return null;
  }
  if (!token) return null;
  const env = getSupabasePublicEnv();
  if (!env) return null;
  const supabase = createSupabaseJsClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return {
    userId: data.user.id as user_id_string,
    email: typeof data.user.email === "string" ? data.user.email : undefined,
  };
}

async function sessionFromClaims(): Promise<AuthSession | null> {
  const db = await createClient();
  try {
    const { data } = await db.auth.getClaims();
    const sub = data?.claims?.sub;
    if (sub) {
      return {
        userId: sub as user_id_string,
        email: emailFromClaims(data.claims as Record<string, unknown> | undefined),
      };
    }
  } catch {
    /* Auth/JWKS unreachable — fall through to cookie session */
  }
  // AI : cookie session keeps signed-in writes working when getClaims cannot reach Auth.
  const { data: sessionData } = await db.auth.getSession();
  const user = sessionData.session?.user;
  if (!user?.id) return null;
  return {
    userId: user.id as user_id_string,
    email: typeof user.email === "string" ? user.email : undefined,
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

// AI : MCP/CLI send Authorization: Bearer (Supabase access token). GUI requests have no Bearer and still use cookies.
export async function requireAuth(): Promise<AuthSession | NextResponse> {
  if (isVercelWithoutSupabase()) {
    return NextResponse.json({ error: MISCONFIGURED }, { status: 503 });
  }

  const bearer = await sessionFromBearer();
  if (bearer) return bearer;

  if (isLocalDevMode()) {
    if (!getSupabasePublicEnv()) {
      return { userId: LOCAL_DEV_USER_ID, email: undefined };
    }
    try {
      const session = await sessionFromClaims();
      if (session) return session;
    } catch {
      /* local dev without a cookie session */
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
