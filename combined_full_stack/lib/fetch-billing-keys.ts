import { API_ROUTES } from "@/lib/api-routes"
import { FETCH_CREDENTIALS, logApiFailure, readApiErrorBody } from "@/lib/api-client"
import {
  readBillingKeysSnapshot,
  writeBillingKeysSnapshot,
  type BillingKeySnapshot,
} from "@/lib/billing-keys-snapshot-cache"

// AI : keys rarely change — coalesce + TTL so mount/hover prefetch does not burn rate limits.
const KEYS_REFRESH_MIN_MS = 30_000

let fetchRef: Promise<BillingKeySnapshot[]> | null = null
let lastOkAt = 0
let rateLimitedUntil = 0

export type FetchBillingKeysOpts = { force?: boolean }

export async function fetchBillingKeys(
  opts?: FetchBillingKeysOpts,
): Promise<BillingKeySnapshot[]> {
  const force = opts?.force === true
  const now = Date.now()
  const cached = readBillingKeysSnapshot()

  if (!force && now < rateLimitedUntil) return cached ?? []
  if (!force && fetchRef) return fetchRef
  if (!force && cached && now - lastOkAt < KEYS_REFRESH_MIN_MS) return cached

  const run = (async (): Promise<BillingKeySnapshot[]> => {
    try {
      const res = await fetch(API_ROUTES.billingKeys, { credentials: FETCH_CREDENTIALS })
      if (res.status === 429) {
        const retryAfterSec = Number(res.headers.get("Retry-After"))
        const body = await readApiErrorBody(res)
        logApiFailure(API_ROUTES.billingKeys, res, body, "GET")
        rateLimitedUntil =
          Date.now() +
          (Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 60_000)
        return cached ?? []
      }
      if (!res.ok) {
        const body = await readApiErrorBody(res)
        logApiFailure(API_ROUTES.billingKeys, res, body, "GET")
        return cached ?? []
      }
      const data = (await res.json()) as { keys: BillingKeySnapshot[] }
      writeBillingKeysSnapshot(data.keys)
      lastOkAt = Date.now()
      return data.keys
    } catch {
      return cached ?? []
    }
  })()

  fetchRef = run
  try {
    return await run
  } finally {
    fetchRef = null
  }
}
