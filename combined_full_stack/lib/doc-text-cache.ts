import { API_ROUTES } from "@/lib/api-routes"
import { FETCH_CREDENTIALS, formatApiError, logApiFailure, readApiErrorBody } from "@/lib/api-client"
import { isDemoMode } from "@/lib/demo-mode"
import { fetchSharedRunDocText } from "@/lib/shared-run-doc-cache"

type doc_text_layer = "parser" | "vision"

export type doc_text_payload = { text?: string; content?: string; parser?: string; fromCache?: boolean }

const cache = new Map<string, Promise<unknown>>()

function cacheKey(docId: string, layer: doc_text_layer): string {
  return `${docId}:${layer}`
}

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as Promise<T> | undefined
  if (hit) return hit
  const pending = load().catch((err) => {
    cache.delete(key)
    throw err
  })
  cache.set(key, pending)
  return pending
}

export function docTextContent(data: doc_text_payload): string {
  return data.text ?? data.content ?? ""
}

const DOC_TEXT_429_RETRY_MAX = 20

function retryAfterMs(res: Response): number {
  const sec = Number.parseInt(res.headers.get("Retry-After") ?? "2", 10)
  return Math.max(500, (Number.isFinite(sec) ? sec : 2) * 1000)
}

async function fetchDocTextOnce(docId: string, layer: doc_text_layer): Promise<doc_text_payload> {
  const url = isDemoMode() ? API_ROUTES.demoDocText(docId, layer) : API_ROUTES.docText(docId, layer)
  let serverErrorRetries = 0
  let rateLimitRetries = 0

  while (true) {
    const res = await fetch(url, { credentials: FETCH_CREDENTIALS })
    if (res.ok) return res.json() as Promise<doc_text_payload>

    if (res.status === 429 && rateLimitRetries < DOC_TEXT_429_RETRY_MAX) {
      rateLimitRetries++
      await readApiErrorBody(res)
      await new Promise((r) => setTimeout(r, retryAfterMs(res)))
      continue
    }

    if (serverErrorRetries < 1 && [500, 502, 503, 504].includes(res.status)) {
      serverErrorRetries++
      await readApiErrorBody(res)
      await new Promise((r) => setTimeout(r, 450))
      continue
    }

    const body = await readApiErrorBody(res)
    // AI : 404 is common while project-state cache is ahead of the warm store — callers retry on docs change.
    if (res.status !== 404) logApiFailure(url, res, body, "GET")
    throw new Error(formatApiError(`GET ${url}`, res, body))
  }
}

export function fetchDocText(
  docId: string,
  layer: doc_text_layer = "parser",
  opts?: { linkId?: string; sessionId?: string },
): Promise<doc_text_payload> {
  const key = opts?.linkId
    ? `${cacheKey(docId, layer)}:shared:${opts.linkId}:${opts.sessionId ?? ""}`
    : cacheKey(docId, layer)
  return cached(key, () => {
    if (opts?.linkId) return fetchSharedRunDocText(opts.linkId, docId, layer, opts.sessionId)
    return fetchDocTextOnce(docId, layer)
  })
}

export function invalidateDocText(docId: string): void {
  cache.delete(cacheKey(docId, "parser"))
  cache.delete(cacheKey(docId, "vision"))
}
