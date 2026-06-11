import { NextResponse } from "next/server";
import {
  BILLING_CAP_CENTS,
  SUB_CENTS_PER_MONTH,
  TOPUP_OPTIONS_CENTS,
  USE_COST_CENTS,
  getBillingUserKey,
  loadBillingAccount,
} from "@/lib/server/billing_account";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:billing");

export async function GET() {
  const key = await getBillingUserKey();
  const account = await loadBillingAccount(key);
  apiLog.debug(`GET /api/billing`, { key, balanceCents: account.balanceCents, subscribed: account.subscribed });
  return NextResponse.json({
    balanceCents: account.balanceCents,
    totalBilledCents: account.totalBilledCents,
    subscribed: account.subscribed,
    useCostCents: USE_COST_CENTS,
    topupOptionsCents: [...TOPUP_OPTIONS_CENTS],
    subCentsPerMonth: SUB_CENTS_PER_MONTH,
    billingCapCents: BILLING_CAP_CENTS,
  });
}
