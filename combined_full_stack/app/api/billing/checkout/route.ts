import { NextResponse, type NextRequest } from "next/server";
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { billingCheckoutBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { billingKeyForUser, createCheckoutSession } from "@/lib/server/billing_account";
import { STRIPE_ENABLED } from "@/lib/stripe-enabled";

export async function POST(req: NextRequest) {
  if (!STRIPE_ENABLED) return apiError("Stripe is disabled", HTTP.UNAVAILABLE);
  const ctx = await requireAuthStore("billing");
  if (ctx instanceof NextResponse) return ctx;

  const parsed = await parseRequestJson(req, billingCheckoutBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const { mode, amountCents } = parsed;

  try {
    const key = billingKeyForUser(ctx.auth.userId);
    const session = await createCheckoutSession(key, mode, req.nextUrl.origin, amountCents);
    return NextResponse.json(session);
  } catch (err) {
    const billed = billingResponse(err);
    if (billed) return billed;
    return apiError((err as Error).message, HTTP.INTERNAL);
  }
}
