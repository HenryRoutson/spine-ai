import { isDemoMode } from "@/lib/demo-mode"
import { warmMarketplaceListings } from "@/lib/warm-run-data"

// AI : warm the code-split Run/Share chunk and marketplace browse data before the user clicks the nav button.
export function prefetchRunPanel(): void {
  if (isDemoMode()) return
  void import("@/components/share/share-page")
  void warmMarketplaceListings().catch(() => {})
}
