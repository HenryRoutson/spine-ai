import { appStorageKey } from "@/lib/storage-keys"

export type EarningsAccountSnapshot = {
  balanceCents: number
  totalEarnedCents: number
  totalWithdrawnCents: number
}

const KEY = appStorageKey("earnings-snapshot")

let memorySnapshot: EarningsAccountSnapshot | null = null

function isEarningsAccountSnapshot(v: unknown): v is EarningsAccountSnapshot {
  if (!v || typeof v !== "object") return false
  const o = v as EarningsAccountSnapshot
  return (
    typeof o.balanceCents === "number" &&
    typeof o.totalEarnedCents === "number" &&
    typeof o.totalWithdrawnCents === "number"
  )
}

export function readEarningsSnapshot(): EarningsAccountSnapshot | null {
  if (memorySnapshot) return memorySnapshot
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isEarningsAccountSnapshot(parsed)) return null
    memorySnapshot = parsed
    return parsed
  } catch {
    return null
  }
}

export function writeEarningsSnapshot(account: EarningsAccountSnapshot): void {
  memorySnapshot = account
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(KEY, JSON.stringify(account))
  } catch {
    /* quota — memory cache still helps tab revisits */
  }
}

export function clearEarningsSnapshot(): void {
  memorySnapshot = null
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
