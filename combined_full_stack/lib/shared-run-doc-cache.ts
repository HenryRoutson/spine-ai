"use client"

import { API_ROUTES } from "@/lib/api-routes"
import { FETCH_CREDENTIALS, formatApiError, logApiFailure, readApiErrorBody } from "@/lib/api-client"
import { docTextContent, type doc_text_payload } from "@/lib/doc-text-cache"

type shared_run_doc_cache_row = {
  text: string
  name?: string
  type?: string
  savedAt: number
}

const MAX_CACHED_CHARS = 2_000_000

function cacheKey(linkId: string, docId: string, sessionId?: string): string {
  return `shared-run-doc:${linkId}:${sessionId ?? ""}:${docId}`
}

function readCache(linkId: string, docId: string, sessionId?: string): shared_run_doc_cache_row | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    const raw = sessionStorage.getItem(cacheKey(linkId, docId, sessionId))
    if (!raw) return null
    return JSON.parse(raw) as shared_run_doc_cache_row
  } catch {
    return null
  }
}

export function putSharedRunDocCache(
  linkId: string,
  docId: string,
  row: Omit<shared_run_doc_cache_row, "savedAt">,
  sessionId?: string,
): void {
  if (typeof sessionStorage === "undefined") return
  if (row.text.length > MAX_CACHED_CHARS) return
  try {
    sessionStorage.setItem(
      cacheKey(linkId, docId, sessionId),
      JSON.stringify({ ...row, savedAt: Date.now() } satisfies shared_run_doc_cache_row),
    )
  } catch {
    // AI : quota exceeded — server session still holds the upload.
  }
}

export function getSharedRunDocCache(
  linkId: string,
  docId: string,
  sessionId?: string,
): shared_run_doc_cache_row | null {
  return readCache(linkId, docId, sessionId)
}

export async function cacheUploadFileText(linkId: string, docId: string, file: File): Promise<void> {
  const lower = file.name.toLowerCase()
  const textLike =
    file.type.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".json") ||
    lower.endsWith(".csv")
  if (!textLike) return
  try {
    const text = await file.text()
    putSharedRunDocCache(linkId, docId, { text, name: file.name })
  } catch {
    // AI : binary or unreadable — rely on shared-link GET after upload.
  }
}

export async function fetchSharedRunDocText(
  linkId: string,
  docId: string,
  layer: "parser" | "vision" = "parser",
  sessionId?: string,
): Promise<doc_text_payload> {
  if (layer === "parser") {
    const cached = readCache(linkId, docId, sessionId)
    if (cached) return { text: cached.text, parser: "browser", fromCache: true }
  }

  const url = API_ROUTES.sharedLinkDocText(linkId, docId, { layer, sessionId })
  const res = await fetch(url, { credentials: FETCH_CREDENTIALS })
  if (!res.ok) {
    const body = await readApiErrorBody(res)
    logApiFailure(url, res, body, "GET")
    throw new Error(formatApiError(`GET ${url}`, res, body))
  }
  const data = (await res.json()) as doc_text_payload
  if (layer === "parser") {
    const text = docTextContent(data)
    if (text) putSharedRunDocCache(linkId, docId, { text }, sessionId)
  }
  return data
}

export function sharedRunDocFileUrl(linkId: string, docId: string, sessionId?: string): string {
  return API_ROUTES.sharedLinkDocFile(linkId, docId, sessionId)
}
