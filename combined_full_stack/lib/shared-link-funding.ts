import { SharedLinkFundingMode } from "./types";

// AI : viewer_pays bills the signed-in viewer; other modes bill the link owner.
export function viewerFundsSharedRun(mode: SharedLinkFundingMode): boolean {
  return mode === SharedLinkFundingMode.ViewerPays;
}

// AI : viewer_signs_in = owner pays but viewer must authenticate (no viewer billing).
export function sharedLinkRequiresSignIn(mode: SharedLinkFundingMode): boolean {
  return mode === SharedLinkFundingMode.ViewerPays || mode === SharedLinkFundingMode.ViewerSignsIn;
}

export function sharerFundsSharedRun(mode: SharedLinkFundingMode): boolean {
  return !viewerFundsSharedRun(mode);
}
