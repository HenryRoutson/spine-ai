import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { type BillingUserKey, confirmCheckoutSession } from "@/lib/server/billing_account";
import { STRIPE_ENABLED } from "@/lib/stripe-enabled";

export async function POST(req: NextRequest) {
  if (!STRIPE_ENABLED) return apiError("Stripe is disabled", HTTP.UNAVAILABLE);
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;

  const { sessionId } = (await req.json()) as { sessionId?: string };
  if (!sessionId) return apiError("sessionId required", HTTP.BAD_REQUEST);

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
    return apiError((err as Error).message, HTTP.INTERNAL);
  }
}
