import { NextResponse, type NextRequest } from "next/server";
import {
  BillingError,
  TOPUP_OPTIONS_CENTS,
  createCheckoutSession,
  getBillingUserKey,
} from "@/lib/server/billing_account";

export async function POST(req: NextRequest) {
  const { mode, amountCents } = (await req.json()) as {
    mode: "payment" | "subscription";
    amountCents?: number;
  };
  if (mode !== "payment" && mode !== "subscription") {
    return NextResponse.json({ error: "mode must be payment or subscription" }, { status: 400 });
  }
  if (
    mode === "payment" &&
    (amountCents == null || !TOPUP_OPTIONS_CENTS.includes(amountCents as (typeof TOPUP_OPTIONS_CENTS)[number]))
  ) {
    return NextResponse.json({ error: "amountCents must be a valid top-up amount" }, { status: 400 });
  }

  try {
    const key = await getBillingUserKey();
    const session = await createCheckoutSession(key, mode, req.nextUrl.origin, amountCents);
    return NextResponse.json(session);
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
