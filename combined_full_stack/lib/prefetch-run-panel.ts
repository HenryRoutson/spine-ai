import { warmMarketplaceListings } from "@/lib/warm-run-data"

// AI : warm the code-split Run/Share chunk and marketplace browse data before the user clicks the nav button.
export function prefetchRunPanel(): void {
  void import("@/components/share/share-page")
  void warmMarketplaceListings()
}
