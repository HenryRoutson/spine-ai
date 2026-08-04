import {
  FEEDBACK_MAX_CREDITS_PER_DAY,
  FEEDBACK_MIN_CHARS,
  MIN_ACCOUNT_BALANCE_CENTS,
  MIN_RUN_BALANCE_CENTS,
} from "@/lib/billing_config";
import { NextResponse } from "next/server";
import { apiError, requireAuthStore, storeAuthError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { isUpstreamFetchError } from "@/lib/server/errors";
import {
  BILLING_CAP_CENTS,
  SUB_CENTS_PER_MONTH,
  TOPUP_OPTIONS_CENTS,
  type BillingUserKey,
  loadBillingAccount,
  loadBillingCreditHistory,
} from "@/lib/server/billing_account";
import { loadFreeCreditAmounts } from "@/lib/server/free_credit_schedule";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:billing");

export async function GET() {
  const ctx = await requireAuthStore("billing");
  if (ctx instanceof NextResponse) return ctx;

  const key = ctx.auth.userId as unknown as BillingUserKey;
  try {
    const [account, creditHistory, freeCredits] = await Promise.all([
      loadBillingAccount(key),
      loadBillingCreditHistory(key),
      loadFreeCreditAmounts(),
    ]);
    apiLog.debug(`GET /api/billing`, {
      key,
      balanceCents: account.balanceCents,
      totalUsageCents: account.totalUsageCents,
      subscribed: account.subscribed,
      creditHistoryCount: creditHistory.length,
    });
    return NextResponse.json({
      balanceCents: account.balanceCents,
      totalBilledCents: account.totalBilledCents,
      totalUsageCents: account.totalUsageCents ?? 0,
      freeCreditCents: freeCredits.signupCreditCents,
      feedbackCreditCents: freeCredits.feedbackCreditCents,
      feedbackMinChars: FEEDBACK_MIN_CHARS,
      feedbackMaxCreditsPerDay: FEEDBACK_MAX_CREDITS_PER_DAY,
      subscribed: account.subscribed,
      minRunBalanceCents: MIN_RUN_BALANCE_CENTS,
      minAccountBalanceCents: MIN_ACCOUNT_BALANCE_CENTS,
      topupOptionsCents: [...TOPUP_OPTIONS_CENTS],
      subCentsPerMonth: SUB_CENTS_PER_MONTH,
      billingCapCents: BILLING_CAP_CENTS,
      creditHistory,
    });
  } catch (err) {
    if (isUpstreamFetchError(err)) {
      apiLog.warn(`GET /api/billing upstream fetch failed`, { key });
      return apiError("Billing service temporarily unavailable — try again shortly.", HTTP.UNAVAILABLE);
    }
    return storeAuthError(err);
  }
}
