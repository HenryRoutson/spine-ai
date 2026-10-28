import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { loadCreatorEarnings } from "@/lib/server/creator_earnings";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:earnings");

export async function GET() {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;

  const earnings = await loadCreatorEarnings(ctx.auth.userId);
  apiLog.debug(`GET /api/earnings`, {
    userId: ctx.auth.userId,
    balanceCents: earnings.balanceCents,
    totalEarnedCents: earnings.totalEarnedCents,
  });
  return NextResponse.json({
    balanceCents: earnings.balanceCents,
    totalEarnedCents: earnings.totalEarnedCents,
    totalWithdrawnCents: earnings.totalWithdrawnCents,
  });
}
