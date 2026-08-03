import { appStorageKey } from "@/lib/storage-keys"
import type { MarketplaceListingCard } from "@/lib/marketplace-types"

const KEY = appStorageKey("marketplace-snapshot")

let memorySnapshot: MarketplaceListingCard[] | null = null

function isMarketplaceListingCard(v: unknown): v is MarketplaceListingCard {
  if (!v || typeof v !== "object") return false
  const o = v as MarketplaceListingCard
  return (
    typeof o.id === "string" &&
    typeof o.projectId === "string" &&
    typeof o.title === "string" &&
    typeof o.description === "string" &&
    typeof o.priceCents === "number" &&
    typeof o.cloneCount === "number" &&
    typeof o.createdAt === "number" &&
    typeof o.revoked === "boolean" &&
    typeof o.stepCount === "number" &&
    Array.isArray(o.stepKinds)
  )
}

export function readMarketplaceSnapshot(): MarketplaceListingCard[] | null {
  if (memorySnapshot) return memorySnapshot
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isMarketplaceListingCard)) return null
    memorySnapshot = parsed
    return parsed
  } catch {
    return null
  }
}

export function writeMarketplaceSnapshot(listings: MarketplaceListingCard[]): void {
  memorySnapshot = listings
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(KEY, JSON.stringify(listings))
  } catch {
    /* quota — memory cache still helps tab revisits */
  }
}

export function clearMarketplaceSnapshot(): void {
  memorySnapshot = null
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
