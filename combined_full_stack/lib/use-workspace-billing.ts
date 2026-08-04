"use client"

import { useOptionalConsumerStore, useOptionalStore } from "@/lib/store"

// AI : billing UI works in builder and consumer workspace modes.
export function useWorkspaceBilling() {
  const builder = useOptionalStore()
  const consumer = useOptionalConsumerStore()
  const source = builder ?? consumer
  if (!source) throw new Error("useWorkspaceBilling requires StoreProvider")
  return {
    billingAccount: source.billingAccount,
    refreshBilling: source.refreshBilling,
    refreshBillingRuns: source.refreshBillingRuns,
    billingRuns: source.billingRuns,
    runs: builder?.runs ?? [],
    project: builder?.project ?? null,
    projects: source.projects ?? [],
  }
}
