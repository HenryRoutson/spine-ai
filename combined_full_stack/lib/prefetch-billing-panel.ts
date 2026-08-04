import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { writeBillingKeysSnapshot, type BillingKeySnapshot } from "@/lib/billing-keys-snapshot-cache"
import { readBillingRunsCache, writeBillingRunsCache } from "@/lib/project-state-cache"
import type { PipelineRun } from "@/lib/types"

// AI : warm the code-split Billing chunk, chart sub-chunk, billing-keys API, and account runs before click.
export function prefetchBillingPanel(): void {
  void import("@/components/billing")
  void import("@/components/billing-spend-chart")
  void apiJson<{ keys: BillingKeySnapshot[] }>(API_ROUTES.billingKeys)
    .then((data) => writeBillingKeysSnapshot(data.keys))
    .catch(() => {})
  if (!readBillingRunsCache()) {
    void apiJson<{ runs: PipelineRun[] }>(API_ROUTES.runsAccount)
      .then((data) => writeBillingRunsCache(data.runs))
      .catch(() => {})
  }
}
