import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { isDemoMode } from "@/lib/demo-mode"
import type { MarketplaceListingCard, MarketplaceListingKind } from "@/lib/marketplace-types"
import {
  readMarketplaceSnapshot,
  writeMarketplaceSnapshot,
} from "@/lib/marketplace-snapshot-cache"

let defaultListingsFetchRef: Promise<MarketplaceListingCard[]> | null = null

export async function fetchMarketplaceListings(
  query = "",
  kind?: MarketplaceListingKind,
): Promise<MarketplaceListingCard[]> {
  if (isDemoMode()) return readMarketplaceSnapshot() ?? []
  const trimmed = query.trim()
  if (!trimmed && !kind) {
    if (defaultListingsFetchRef) return defaultListingsFetchRef
    const run = loadMarketplaceListings("")
    defaultListingsFetchRef = run.finally(() => {
      defaultListingsFetchRef = null
    })
    return defaultListingsFetchRef
  }
  return loadMarketplaceListings(trimmed, kind)
}

export function warmMarketplaceListings(): Promise<void> {
  return fetchMarketplaceListings().then(() => {})
}

async function loadMarketplaceListings(
  query: string,
  kind?: MarketplaceListingKind,
): Promise<MarketplaceListingCard[]> {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (kind) params.set("kind", kind)
  const qs = params.toString()
  const body = await apiJson<{ listings: MarketplaceListingCard[] }>(
    `${API_ROUTES.marketplace}${qs ? `?${qs}` : ""}`,
  )
  if (!query) writeMarketplaceSnapshot(body.listings)
  return body.listings
}

export function readCachedMarketplaceListings(): MarketplaceListingCard[] | null {
  return readMarketplaceSnapshot()
}
