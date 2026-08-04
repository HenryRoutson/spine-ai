import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { writeBillingKeysSnapshot, type BillingKeySnapshot } from "@/lib/billing-keys-snapshot-cache"

// AI : warm the code-split Billing chunk, chart sub-chunk, and billing-keys API before click.
export function prefetchBillingPanel(): void {
  void import("@/components/billing")
  void import("@/components/billing-spend-chart")
  void apiJson<{ keys: BillingKeySnapshot[] }>(API_ROUTES.billingKeys)
    .then((data) => writeBillingKeysSnapshot(data.keys))
    .catch(() => {})
}
