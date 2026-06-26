// AI : TODO refactor — align with apiError/HTTP + requireAuthStore (see app/api/billing/route.ts).
import { NextResponse, type NextRequest } from "next/server";
import { confirmCheckoutSession, getBillingUserKey } from "@/lib/server/billing_account";

export async function POST(req: NextRequest) {
  const { sessionId } = (await req.json()) as { sessionId?: string };
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  try {
    const key = await getBillingUserKey();
    const { account, creditedCents } = await confirmCheckoutSession(key, sessionId);
    return NextResponse.json({
      balanceCents: account.balanceCents,
      totalBilledCents: account.totalBilledCents,
      subscribed: account.subscribed,
      creditedCents,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
