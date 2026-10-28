import { API_ROUTES } from "@/lib/api-routes"
import { FETCH_CREDENTIALS, formatApiError, logApiFailure, readApiErrorBody } from "@/lib/api-client"
import { isDemoMode } from "@/lib/demo-mode"
import {
  readBillingKeysSnapshot,
  writeBillingKeysSnapshot,
  type BillingKeySnapshot,
} from "@/lib/billing-keys-snapshot-cache"

// AI : keys rarely change — coalesce + TTL so mount/hover prefetch does not burn rate limits.
const KEYS_REFRESH_MIN_MS = 30_000
const KEYS_RETRY_MAX = 2
const KEYS_RETRY_MS = 700
const KEYS_LOAD_FAILED = "Couldn't load billing keys — retry shortly."

let fetchRef: Promise<FetchBillingKeysResult> | null = null
let lastOkAt = 0
let rateLimitedUntil = 0

export type FetchBillingKeysOpts = { force?: boolean }

export type FetchBillingKeysResult = {
  keys: BillingKeySnapshot[]
  error: string | null
}

function isRetryableKeysStatus(status: number): boolean {
  return status === 500 || status === 503
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchBillingKeys(
  opts?: FetchBillingKeysOpts,
): Promise<FetchBillingKeysResult> {
  if (isDemoMode()) return { keys: readBillingKeysSnapshot() ?? [], error: null }
  const force = opts?.force === true
  const now = Date.now()
  const cached = readBillingKeysSnapshot()

  if (!force && now < rateLimitedUntil) return { keys: cached ?? [], error: null }
  if (!force && fetchRef) return fetchRef
  if (!force && cached && now - lastOkAt < KEYS_REFRESH_MIN_MS) {
    return { keys: cached, error: null }
  }

  const run = (async (): Promise<FetchBillingKeysResult> => {
    for (let attempt = 0; attempt <= KEYS_RETRY_MAX; attempt++) {
      try {
        const res = await fetch(API_ROUTES.billingKeys, { credentials: FETCH_CREDENTIALS })
        if (res.status === 429) {
          const retryAfterSec = Number(res.headers.get("Retry-After"))
          const body = await readApiErrorBody(res)
          logApiFailure(API_ROUTES.billingKeys, res, body, "GET")
          rateLimitedUntil =
            Date.now() +
            (Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 60_000)
          return { keys: cached ?? [], error: null }
        }
        if (res.ok) {
          const data = (await res.json()) as { keys: BillingKeySnapshot[] }
          writeBillingKeysSnapshot(data.keys)
          lastOkAt = Date.now()
          return { keys: data.keys, error: null }
        }
        const body = await readApiErrorBody(res)
        // AI : 500/503 here is expected (JWT clock skew, upstream timeout) — retry then surface in UI.
        if (isRetryableKeysStatus(res.status) && attempt < KEYS_RETRY_MAX) {
          await sleep(KEYS_RETRY_MS)
          continue
        }
        if (!isRetryableKeysStatus(res.status)) {
          logApiFailure(API_ROUTES.billingKeys, res, body, "GET")
        }
        return {
          keys: cached ?? [],
          error: isRetryableKeysStatus(res.status)
            ? KEYS_LOAD_FAILED
            : body?.error || formatApiError(`GET ${API_ROUTES.billingKeys}`, res, body),
        }
      } catch {
        if (attempt < KEYS_RETRY_MAX) {
          await sleep(KEYS_RETRY_MS)
          continue
        }
        return { keys: cached ?? [], error: KEYS_LOAD_FAILED }
      }
    }
    return { keys: cached ?? [], error: KEYS_LOAD_FAILED }
  })()

  fetchRef = run
  try {
    return await run
  } finally {
    fetchRef = null
  }
}
