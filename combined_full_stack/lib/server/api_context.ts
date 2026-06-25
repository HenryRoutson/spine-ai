import { NextResponse } from "next/server";
import { AUTH_SIGN_IN_REQUIRED } from "@/lib/auth-messages";
import { HTTP } from "./api-errors";
import { getStore } from "./app_store";
import { BillingError } from "./billing_account";
import { storeErrorMessage } from "./errors";
import { isAuthSession, requireAuth, type AuthSession } from "./require_auth";
import type { Store } from "./store";

export function apiError(message: string, status: number, code?: string): NextResponse {
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status });
}

export function storeAuthError(err: unknown): NextResponse {
  const message = storeErrorMessage(err);
  if (message === AUTH_SIGN_IN_REQUIRED) return apiError(message, HTTP.UNAUTHORIZED);
  if (message.includes("Supabase env")) return apiError(message, HTTP.UNAVAILABLE);
  return apiError(message, HTTP.INTERNAL);
}

// AI : one entry point for routes that need both session identity and the data store.
export async function requireAuthStore(): Promise<{ auth: AuthSession; store: Store } | NextResponse> {
  const auth = await requireAuth();
  if (!isAuthSession(auth)) return auth;
  try {
    return { auth, store: await getStore() };
  } catch (err) {
    return storeAuthError(err);
  }
}

export function billingResponse(err: unknown): NextResponse | null {
  if (err instanceof BillingError) return apiError(err.message, HTTP.PAYMENT_REQUIRED, err.code);
  return null;
}
