import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import type { MarketplaceListingCard } from "@/lib/marketplace-types"
import {
  readMarketplaceSnapshot,
  writeMarketplaceSnapshot,
} from "@/lib/marketplace-snapshot-cache"

let defaultListingsFetchRef: Promise<MarketplaceListingCard[]> | null = null

export async function fetchMarketplaceListings(query = ""): Promise<MarketplaceListingCard[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    if (defaultListingsFetchRef) return defaultListingsFetchRef
    const run = loadMarketplaceListings("")
    defaultListingsFetchRef = run.finally(() => {
      defaultListingsFetchRef = null
    })
    return defaultListingsFetchRef
  }
  return loadMarketplaceListings(trimmed)
}

export function warmMarketplaceListings(): Promise<void> {
  return fetchMarketplaceListings().then(() => {})
}

async function loadMarketplaceListings(query: string): Promise<MarketplaceListingCard[]> {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
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
