import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"

type doc_text_layer = "parser" | "vision"

type doc_text_payload = { text?: string; content?: string; parser?: string; fromCache?: boolean }

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

function isRetryableDocTextError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /\(HTTP (500|502|503|504)\)/.test(msg)
}

async function fetchDocTextOnce(docId: string, layer: doc_text_layer): Promise<doc_text_payload> {
  // AI : first fetch during a cold SupabaseStore init can 500 — one short retry before surfacing.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await apiJson<doc_text_payload>(API_ROUTES.docText(docId, layer))
    } catch (err) {
      if (attempt === 0 && isRetryableDocTextError(err)) {
        await new Promise((r) => setTimeout(r, 450))
        continue
      }
      throw err
    }
  }
  throw new Error("doc text fetch failed")
}

export function fetchDocText(docId: string, layer: doc_text_layer = "parser"): Promise<doc_text_payload> {
  return cached(cacheKey(docId, layer), () => fetchDocTextOnce(docId, layer))
}

export function invalidateDocText(docId: string): void {
  cache.delete(cacheKey(docId, "parser"))
  cache.delete(cacheKey(docId, "vision"))
}
