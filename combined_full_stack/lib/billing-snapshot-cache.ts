import { appStorageKey } from "@/lib/storage-keys"

export type BillingCreditHistorySnapshot = {
  creditKey: string
  amountCents: number
  source: "checkout" | "invoice" | "feedback"
  createdAt: string
}

export type BillingAccountSnapshot = {
  balanceCents: number
  totalBilledCents: number
  totalUsageCents: number
  freeCreditCents: number
  feedbackCreditCents: number
  feedbackMinChars: number
  feedbackMaxCreditsPerDay: number
  subscribed: boolean
  minRunBalanceCents: number
  topupOptionsCents: number[]
  subCentsPerMonth: number
  billingCapCents: number
  creditHistory: BillingCreditHistorySnapshot[]
}

const KEY = appStorageKey("billing-snapshot")

let memorySnapshot: BillingAccountSnapshot | null = null

function isBillingAccountSnapshot(v: unknown): v is BillingAccountSnapshot {
  if (!v || typeof v !== "object") return false
  const o = v as BillingAccountSnapshot
  return (
    typeof o.balanceCents === "number" &&
    typeof o.totalBilledCents === "number" &&
    typeof o.totalUsageCents === "number" &&
    typeof o.freeCreditCents === "number" &&
    typeof o.feedbackCreditCents === "number" &&
    typeof o.feedbackMinChars === "number" &&
    typeof o.feedbackMaxCreditsPerDay === "number" &&
    typeof o.subscribed === "boolean" &&
    typeof o.minRunBalanceCents === "number" &&
    Array.isArray(o.topupOptionsCents) &&
    typeof o.subCentsPerMonth === "number" &&
    typeof o.billingCapCents === "number" &&
    Array.isArray(o.creditHistory)
  )
}

export function readBillingSnapshot(): BillingAccountSnapshot | null {
  if (memorySnapshot) return memorySnapshot
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isBillingAccountSnapshot(parsed)) return null
    memorySnapshot = parsed
    return parsed
  } catch {
    return null
  }
}

export function writeBillingSnapshot(account: BillingAccountSnapshot): void {
  memorySnapshot = account
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(KEY, JSON.stringify(account))
  } catch {
    /* quota — memory cache still helps tab revisits */
  }
}

export function clearBillingSnapshot(): void {
  memorySnapshot = null
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
