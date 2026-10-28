import { HostedApiFundingMode } from "./types";

// AI : caller_pays bills the API caller; owner_pays bills the API owner.
export function callerFundsHostedApi(mode: HostedApiFundingMode): boolean {
  return mode === HostedApiFundingMode.CallerPays;
}

export function ownerFundsHostedApi(mode: HostedApiFundingMode): boolean {
  return !callerFundsHostedApi(mode);
}
