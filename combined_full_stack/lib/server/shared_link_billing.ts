import { billingKeyForUser, billRunUsage, type BillingUserKey } from "@/lib/server/billing_account";
import { creditCreatorEarnings } from "@/lib/server/creator_earnings";
import { computeBillableCharge, customPricingAppliesToLink } from "@/lib/server/billable_pricing";
import { SharedLinkFundingMode } from "@/lib/server/types";
import type { user_id_string } from "@/lib/server/require_auth";
import type { SharedLinkRecord } from "@/lib/shared-link-types";
import { viewerFundsSharedRun } from "@/lib/shared-link-funding";
import { logger } from "@/lib/server/server_logger";

export { viewerFundsSharedRun } from "@/lib/shared-link-funding";

const billLog = logger("shared-link-billing");

export function sharedLinkBillingKey(
  ownerId: user_id_string,
  fundingMode: SharedLinkFundingMode,
  viewerUserId?: user_id_string,
): BillingUserKey {
  if (viewerFundsSharedRun(fundingMode) && viewerUserId) {
    return billingKeyForUser(viewerUserId);
  }
  return billingKeyForUser(ownerId);
}

export type SharedLinkBillResult = {
  usageCents: number;
  earningsCents: number;
  totalCents: number;
};

// AI : bill viewer for multiple × LLM cost + flat fee; credit earnings above raw usage.
export async function billSharedLinkRun(
  billingKey: BillingUserKey,
  ownerId: user_id_string,
  link: Pick<SharedLinkRecord, "fundingMode" | "billingMultiple" | "flatFeeCents">,
  usageCents: number,
): Promise<SharedLinkBillResult> {
  const charge = computeBillableCharge(
    usageCents,
    { billingMultiple: link.billingMultiple, flatFeeCents: link.flatFeeCents },
    customPricingAppliesToLink(link),
  );
  if (charge.totalCents <= 0) {
    return {
      usageCents: charge.usageCents,
      earningsCents: charge.earningsCents,
      totalCents: charge.totalCents,
    };
  }

  await billRunUsage(billingKey, charge.totalCents, { flowType: "usage_shared_link" });
  if (charge.earningsCents > 0) {
    await creditCreatorEarnings(ownerId, charge.earningsCents);
  }
  billLog.info(`billSharedLinkRun ok`, {
    ownerId,
    usage: charge.usageCents,
    earningsCents: charge.earningsCents,
    totalCents: charge.totalCents,
  });
  return {
    usageCents: charge.usageCents,
    earningsCents: charge.earningsCents,
    totalCents: charge.totalCents,
  };
}
