import { billingKeyForUser, billRunUsage, type BillingUserKey } from "@/lib/server/billing_account";
import { creditCreatorEarnings } from "@/lib/server/creator_earnings";
import { computeBillableCharge, hasCustomBillablePricing } from "@/lib/server/billable_pricing";
import { callerFundsHostedApi } from "@/lib/hosted-api-funding";
import { HostedApiFundingMode } from "@/lib/server/types";
import type { user_id_string } from "@/lib/server/require_auth";
import type { HostedApiRecord } from "@/lib/hosted-api-types";
import { logger } from "@/lib/server/server_logger";

const billLog = logger("hosted-api-billing");

export const SPINE_API_KEY_HEADER = "x-spine-api-key";
export const SPINE_BILLING_KEY_HEADER = "x-spine-billing-key";

export { callerFundsHostedApi } from "@/lib/hosted-api-funding";

export type HostedApiBillResult = {
  usageCents: number;
  earningsCents: number;
  totalCents: number;
};

export function hostedApiCustomPricingApplies(
  api: Pick<HostedApiRecord, "fundingMode" | "billingMultiple" | "flatFeeCents">,
): boolean {
  return callerFundsHostedApi(api.fundingMode);
}

export function hostedApiBillingKey(
  ownerId: user_id_string,
  fundingMode: HostedApiFundingMode,
  callerUserId?: user_id_string,
): BillingUserKey {
  if (callerFundsHostedApi(fundingMode) && callerUserId) {
    return billingKeyForUser(callerUserId);
  }
  return billingKeyForUser(ownerId);
}

export async function billHostedApiRun(
  billingKey: BillingUserKey,
  ownerId: user_id_string,
  api: Pick<HostedApiRecord, "fundingMode" | "billingMultiple" | "flatFeeCents">,
  usageCents: number,
): Promise<HostedApiBillResult> {
  const charge = computeBillableCharge(
    usageCents,
    { billingMultiple: api.billingMultiple, flatFeeCents: api.flatFeeCents },
    hostedApiCustomPricingApplies(api),
  );
  if (charge.totalCents <= 0) {
    return {
      usageCents: charge.usageCents,
      earningsCents: charge.earningsCents,
      totalCents: charge.totalCents,
    };
  }

  await billRunUsage(billingKey, charge.totalCents);
  if (charge.earningsCents > 0) {
    await creditCreatorEarnings(ownerId, charge.earningsCents);
  }
  billLog.info(`billHostedApiRun ok`, {
    ownerId,
    usage: charge.usageCents,
    earningsCents: charge.earningsCents,
    totalCents: charge.totalCents,
    customPricing: hasCustomBillablePricing(api),
  });
  return {
    usageCents: charge.usageCents,
    earningsCents: charge.earningsCents,
    totalCents: charge.totalCents,
  };
}
