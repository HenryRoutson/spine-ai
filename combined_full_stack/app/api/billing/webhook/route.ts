import { NextResponse } from "next/server";
import { apiError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { handleStripeWebhook, verifyStripeWebhookPayload } from "@/lib/server/billing_account";
import { logger } from "@/lib/server/server_logger";
import { STRIPE_ENABLED } from "@/lib/stripe-enabled";

export const dynamic = "force-dynamic";

const apiLog = logger("api:billing:webhook");

// AI : Stripe sends invoice.paid on subscription renewals — signature-verified, idempotent credit grant.
export async function POST(req: Request) {
  if (!STRIPE_ENABLED) return NextResponse.json({ received: true });
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  try {
    const event = verifyStripeWebhookPayload(body, signature);
    await handleStripeWebhook(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    apiLog.error(`webhook rejected`, { error: (err as Error).message });
    return apiError((err as Error).message, HTTP.BAD_REQUEST);
  }
}
