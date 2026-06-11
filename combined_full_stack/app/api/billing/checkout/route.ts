import { NextResponse, type NextRequest } from "next/server";
import { BillingError, createCheckoutSession, getBillingUserKey } from "@/lib/server/billing_account";

export async function POST(req: NextRequest) {
  const { mode } = (await req.json()) as { mode: "payment" | "subscription" };
  if (mode !== "payment" && mode !== "subscription") {
    return NextResponse.json({ error: "mode must be payment or subscription" }, { status: 400 });
  }

  try {
    const key = await getBillingUserKey();
    const session = await createCheckoutSession(key, mode, req.nextUrl.origin);
    return NextResponse.json(session);
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
