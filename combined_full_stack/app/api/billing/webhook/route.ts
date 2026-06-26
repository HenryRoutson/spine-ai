// AI : TODO refactor — align with apiError/HTTP where applicable (see app/api/billing/route.ts).
import { NextResponse } from "next/server";
import { handleStripeWebhook, verifyStripeWebhookPayload } from "@/lib/server/billing_account";
import { logger } from "@/lib/server/server_logger";

export const dynamic = "force-dynamic";

const apiLog = logger("api:billing:webhook");

// AI : Stripe sends invoice.paid on subscription renewals — signature-verified, idempotent credit grant.
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  try {
    const event = verifyStripeWebhookPayload(body, signature);
    await handleStripeWebhook(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    apiLog.error(`webhook rejected`, { error: (err as Error).message });
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
