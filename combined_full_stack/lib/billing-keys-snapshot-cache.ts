import { appStorageKey } from "@/lib/storage-keys"

export type BillingKeySnapshot = {
  id: string
  label: string
  keyPrefix: string
  createdAt: number
}

const KEY = appStorageKey("billing-keys-snapshot")

let memorySnapshot: BillingKeySnapshot[] | null = null

function isBillingKeySnapshot(v: unknown): v is BillingKeySnapshot {
  if (!v || typeof v !== "object") return false
  const o = v as BillingKeySnapshot
  return (
    typeof o.id === "string" &&
    typeof o.label === "string" &&
    typeof o.keyPrefix === "string" &&
    typeof o.createdAt === "number"
  )
}

export function readBillingKeysSnapshot(): BillingKeySnapshot[] | null {
  if (memorySnapshot) return memorySnapshot
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isBillingKeySnapshot)) return null
    memorySnapshot = parsed
    return parsed
  } catch {
    return null
  }
}

export function writeBillingKeysSnapshot(keys: BillingKeySnapshot[]): void {
  memorySnapshot = keys
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(KEY, JSON.stringify(keys))
  } catch {
    /* quota — memory cache still helps tab revisits */
  }
}

export function clearBillingKeysSnapshot(): void {
  memorySnapshot = null
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
