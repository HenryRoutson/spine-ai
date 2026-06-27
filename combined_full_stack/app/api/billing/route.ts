import { MIN_ACCOUNT_BALANCE_CENTS, MIN_RUN_BALANCE_CENTS } from "@/lib/billing_config";
import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import {
  BILLING_CAP_CENTS,
  SUB_CENTS_PER_MONTH,
  TOPUP_OPTIONS_CENTS,
  type BillingUserKey,
  loadBillingAccount,
} from "@/lib/server/billing_account";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:billing");

export async function GET() {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;

  const key = ctx.auth.userId as unknown as BillingUserKey;
  const account = await loadBillingAccount(key);
  apiLog.debug(`GET /api/billing`, { key, balanceCents: account.balanceCents, subscribed: account.subscribed });
  return NextResponse.json({
    balanceCents: account.balanceCents,
    totalBilledCents: account.totalBilledCents,
    subscribed: account.subscribed,
    minRunBalanceCents: MIN_RUN_BALANCE_CENTS,
    minAccountBalanceCents: MIN_ACCOUNT_BALANCE_CENTS,
    topupOptionsCents: [...TOPUP_OPTIONS_CENTS],
    subCentsPerMonth: SUB_CENTS_PER_MONTH,
    billingCapCents: BILLING_CAP_CENTS,
  });
}
