import { NextResponse } from "next/server";
import {
  BILLING_CAP_CENTS,
  SUB_CENTS_PER_MONTH,
  TOPUP_OPTIONS_CENTS,
  USE_COST_CENTS,
  getBillingUserKey,
  loadBillingAccount,
} from "@/lib/server/billing_account";

export async function GET() {
  const key = await getBillingUserKey();
  const account = await loadBillingAccount(key);
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
