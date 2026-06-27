import { NextResponse, type NextRequest } from "next/server";
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import {
  TOPUP_OPTIONS_CENTS,
  type BillingUserKey,
  createCheckoutSession,
} from "@/lib/server/billing_account";

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;

  const { mode, amountCents } = (await req.json()) as {
    mode: "payment" | "subscription";
    amountCents?: number;
  };
  if (mode !== "payment" && mode !== "subscription") {
    return apiError("mode must be payment or subscription", HTTP.BAD_REQUEST);
  }
  if (
    mode === "payment" &&
    (amountCents == null || !TOPUP_OPTIONS_CENTS.includes(amountCents as (typeof TOPUP_OPTIONS_CENTS)[number]))
  ) {
    return apiError("amountCents must be a valid top-up amount", HTTP.BAD_REQUEST);
  }

  try {
    const key = ctx.auth.userId as unknown as BillingUserKey;
    const session = await createCheckoutSession(key, mode, req.nextUrl.origin, amountCents);
    return NextResponse.json(session);
  } catch (err) {
    const billed = billingResponse(err);
    if (billed) return billed;
    return apiError((err as Error).message, HTTP.INTERNAL);
  }
}
