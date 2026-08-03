import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { writeBillingKeysSnapshot, type BillingKeySnapshot } from "@/lib/billing-keys-snapshot-cache"

// AI : warm the code-split Billing chunk and billing-keys API before the user clicks the nav button.
export function prefetchBillingPanel(): void {
  void import("@/components/billing")
  void apiJson<{ keys: BillingKeySnapshot[] }>(API_ROUTES.billingKeys)
    .then((data) => writeBillingKeysSnapshot(data.keys))
    .catch(() => {})
}
