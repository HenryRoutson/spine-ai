import { NextResponse, type NextRequest } from "next/server";
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { billingConfirmBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { type BillingUserKey, confirmCheckoutSession } from "@/lib/server/billing_account";
import { STRIPE_ENABLED } from "@/lib/stripe-enabled";

export async function POST(req: NextRequest) {
  if (!STRIPE_ENABLED) return apiError("Stripe is disabled", HTTP.UNAVAILABLE);
  const ctx = await requireAuthStore("billing");
  if (ctx instanceof NextResponse) return ctx;

  const parsed = await parseRequestJson(req, billingConfirmBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const { sessionId } = parsed;

  try {
    const key = ctx.auth.userId as unknown as BillingUserKey;
    const { account, creditedCents } = await confirmCheckoutSession(key, sessionId);
    return NextResponse.json({
      balanceCents: account.balanceCents,
      totalBilledCents: account.totalBilledCents,
      totalUsageCents: account.totalUsageCents ?? 0,
      subscribed: account.subscribed,
      creditedCents,
    });
  } catch (err) {
    const billed = billingResponse(err);
    if (billed) return billed;
    const message = (err as Error).message;
    if (message.includes("different account")) return apiError(message, HTTP.FORBIDDEN);
    if (message.includes("Checkout not paid") || message.includes("Invalid")) {
      return apiError(message, HTTP.BAD_REQUEST);
    }
    return apiError(message, HTTP.INTERNAL);
  }
}
