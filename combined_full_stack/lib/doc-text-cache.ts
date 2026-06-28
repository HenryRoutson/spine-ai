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

export function fetchDocText(docId: string, layer: doc_text_layer = "parser"): Promise<doc_text_payload> {
  return cached(cacheKey(docId, layer), () =>
    apiJson<doc_text_payload>(API_ROUTES.docText(docId, layer)),
  )
}

export function invalidateDocText(docId: string): void {
  cache.delete(cacheKey(docId, "parser"))
  cache.delete(cacheKey(docId, "vision"))
}
