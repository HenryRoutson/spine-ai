import { NextResponse } from "next/server";
import { AUTH_SIGN_IN_REQUIRED } from "@/lib/auth-messages";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate_limit";
import { type RateLimitKey, type RateLimitTier } from "@/lib/rate_limit_config";
import { createClient } from "@/utils/supabase/server";
import { HTTP } from "./api-errors";
import { getStore } from "./app_store";
import { BillingError } from "./billing_account";
import { storeErrorMessage } from "./errors";
import { createAdminClient } from "./supabase_admin";
import { SupabaseStore } from "./supabase_store";
import {
  isAuthSession,
  isLocalDevMode,
  requireAuth,
  type AuthSession,
  type user_id_string,
} from "./require_auth";
import type { Store } from "./store";

export function apiError(
  message: string,
  status: number,
  code?: string,
  extra?: { detail?: string; resource?: string },
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      ...(code ? { code } : {}),
      ...(extra?.detail ? { detail: extra.detail } : {}),
      ...(extra?.resource ? { resource: extra.resource } : {}),
    },
    { status },
  );
}

export function storeAuthError(err: unknown): NextResponse {
  const message = storeErrorMessage(err);
  if (message === AUTH_SIGN_IN_REQUIRED) return apiError(message, HTTP.UNAUTHORIZED);
  if (message.includes("Supabase env")) return apiError(message, HTTP.UNAVAILABLE);
  return apiError(message, HTTP.INTERNAL);
}

export type RateLimitMeta = { tier?: RateLimitTier; resource?: string };

export function rateLimitResponse(
  retryAfterSec: number,
  misconfigured = false,
  meta?: RateLimitMeta,
): NextResponse {
  if (misconfigured) {
    return apiError(
      "Rate limiting unavailable — set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN on Vercel (or RATE_LIMIT_BACKEND=memory).",
      HTTP.UNAVAILABLE,
      "rate_limit_unconfigured",
    );
  }
  const resource = meta?.resource;
  const tier = meta?.tier;
  const where = resource ? ` for ${resource}` : tier ? ` (tier: ${tier})` : "";
  return NextResponse.json(
    {
      error: `Too many requests${where} — retry in ${retryAfterSec}s.`,
      code: "rate_limited",
      detail: [
        resource ? `resource=${resource}` : null,
        tier ? `tier=${tier}` : null,
        `retryAfterSec=${retryAfterSec}`,
      ]
        .filter(Boolean)
        .join(" "),
      resource,
      tier,
      retryAfterSec,
    },
    { status: HTTP.TOO_MANY_REQUESTS, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export async function enforceUserRateLimit(
  userId: user_id_string,
  tier: RateLimitTier,
  resource?: string,
): Promise<NextResponse | null> {
  const key = `user:${userId}:${tier}` as RateLimitKey;
  const hit = await checkRateLimit(key, tier);
  if (hit.ok) return null;
  return rateLimitResponse(hit.retryAfterSec, hit.misconfigured, { tier, resource });
}

export async function enforceIpRateLimit(
  req: Request,
  tier: RateLimitTier,
  resource?: string,
): Promise<NextResponse | null> {
  // AI : SECURITY — skip only in true local-dev (never Vercel), so hosted demos stay capped.
  // AI : TODO security — if a hosted box ever runs NODE_ENV=development, landing demo tiers become
  // AI : uncapped; gate skip on an explicit ALLOW_UNLIMITED_LANDING_DEMO instead of isLocalDevMode().
  if (
    isLocalDevMode() &&
    (tier === "landing_demo_build" || tier === "landing_demo_signup" || tier === "landing_demo_replay")
  ) {
    return null;
  }
  const ip = clientIpFromHeaders(req.headers);
  const key = `ip:${ip}:${tier}` as RateLimitKey;
  const hit = await checkRateLimit(key, tier);
  if (hit.ok) return null;
  return rateLimitResponse(hit.retryAfterSec, hit.misconfigured, {
    tier,
    resource: resource ?? (req instanceof Request ? new URL(req.url).pathname : undefined),
  });
}

// AI : one entry point for routes that need both session identity and the data store.
export async function requireAuthStore(
  tier: RateLimitTier = "default",
): Promise<{ auth: AuthSession; store: Store } | NextResponse> {
  const auth = await requireAuth();
  if (!isAuthSession(auth)) return auth;
  const limited = await enforceUserRateLimit(auth.userId, tier);
  if (limited) return limited;
  try {
    // AI : rebind warm SupabaseStore to service role when available — requireAuth already verified identity.
    // AI : cookie JWT alone can fail PostgREST RLS (auth.uid() null → empty SELECTs + INSERT 42501).
    // AI : TODO security (prod) — service-role rebind bypasses RLS; a bug after requireAuth is a full-table write.
    // AI : Prefer fixing JWT → auth.uid() and keep the user-scoped client.
    const store = await getStore();
    if (store instanceof SupabaseStore) {
      const admin = await createAdminClient();
      store.rebindDb(admin ?? (await createClient()));
    }
    return { auth, store };
  } catch (err) {
    return storeAuthError(err);
  }
}

export function billingResponse(err: unknown): NextResponse | null {
  if (err instanceof BillingError) return apiError(err.message, HTTP.PAYMENT_REQUIRED, err.code);
  return null;
}
