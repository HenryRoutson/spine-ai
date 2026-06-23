import { NextResponse } from "next/server";
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
  if (message === "Sign in required") return apiError(message, 401);
  if (message.includes("Supabase env")) return apiError(message, 503);
  return apiError(message, 500);
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
  if (err instanceof BillingError) return apiError(err.message, 402, err.code);
  return null;
}
