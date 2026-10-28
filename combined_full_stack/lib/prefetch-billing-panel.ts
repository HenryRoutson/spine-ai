import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { isDemoMode } from "@/lib/demo-mode"
import { fetchBillingKeys } from "@/lib/fetch-billing-keys"
import { readBillingRunsCache, writeBillingRunsCache } from "@/lib/project-state-cache"
import type { PipelineRun } from "@/lib/types"

// AI : warm the code-split Billing chunk, chart sub-chunk, billing-keys API, and account runs before click.
export function prefetchBillingPanel(): void {
  if (isDemoMode()) return
  void import("@/components/billing")
  void import("@/components/billing-spend-chart")
  // AI : coalesce/TTL inside fetchBillingKeys — shell + nav mount used to fire 3+ GETs.
  void fetchBillingKeys()
  if (!readBillingRunsCache()) {
    void apiJson<{ runs: PipelineRun[] }>(API_ROUTES.runsAccount)
      .then((data) => writeBillingRunsCache(data.runs))
      .catch(() => {})
  }
}
