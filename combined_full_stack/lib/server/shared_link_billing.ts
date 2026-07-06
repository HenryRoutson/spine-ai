import { billingKeyForUser, type BillingUserKey } from "@/lib/server/billing_account";
import { SharedLinkFundingMode } from "@/lib/server/types";
import type { user_id_string } from "@/lib/server/require_auth";

// AI : viewer-funded modes bill the signed-in viewer, not the link owner.
export function viewerFundsSharedRun(mode: SharedLinkFundingMode): boolean {
  return mode === SharedLinkFundingMode.ViewerSignsIn || mode === SharedLinkFundingMode.ViewerPays;
}

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
