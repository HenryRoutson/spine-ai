"use client"

import { useEffect, useState } from "react"
import { defaultDocViewMode } from "@/lib/doc-content"
import type { DocViewMode } from "@/lib/doc-viewer"
import { API_ROUTES } from "@/lib/api-routes"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
import { useDocFetchScope } from "@/lib/use-doc-fetch-scope"
import { sharedRunDocFileUrl } from "@/lib/shared-run-doc-cache"
import type { DocId, DocRef } from "@/lib/types"

export type VisionEntry = { key: string; model: string; text: string; createdAt: number }

type UseDocViewerDataArgs = {
  docId: DocId | null
  docRef: Pick<DocRef, "name" | "type"> | undefined
  requestedMode: DocViewMode | null
  spanStart: number
  spanEnd: number
}

export function useDocViewerData({
  docId,
  docRef,
  requestedMode,
  spanStart,
  spanEnd,
}: UseDocViewerDataArgs) {
  const { linkId, docTextOpts } = useDocFetchScope()
  const [hasPdf, setHasPdf] = useState(false)
  const [parserText, setParserText] = useState<string | null>(null)
  const [parserMeta, setParserMeta] = useState<{ parser?: string; fromCache?: boolean }>({})
  const [visionEntries, setVisionEntries] = useState<VisionEntry[]>([])
  const [visionIndex, setVisionIndex] = useState(0)
  const [view, setView] = useState<DocViewMode>("parser")

  // AI : TODO refactor (prod) — PDF tab depends on /file bytes; fix when Supabase Storage ships (store.ts).
  useEffect(() => {
    if (!docId) return
    setHasPdf(false)
    fetch(linkId ? sharedRunDocFileUrl(linkId, docId) : API_ROUTES.docFile(docId), { method: "HEAD" })
      .then((r) => setHasPdf(r.ok))
      .catch(() => setHasPdf(false))
  }, [docId, linkId])

  useEffect(() => {
    if (!docId) return
    setParserText(null)
    setParserMeta({})
    setVisionEntries([])
    setVisionIndex(0)
    const hasSpan = spanStart !== spanEnd
    Promise.all([
      fetchDocText(docId, "parser", docTextOpts).then((parser) =>
        parser.text !== undefined || parser.content !== undefined
          ? parser
          : { text: `⚠ source not found for ${docId}` },
      ),
      docTextOpts?.linkId
        ? Promise.resolve({ entries: [] as VisionEntry[] })
        : fetch(API_ROUTES.docText(docId, "vision")).then((r) =>
            r.ok ? r.json() : { entries: [] as VisionEntry[] },
          ),
    ])
      .then(([parser, vision]) => {
        const visionRows: VisionEntry[] = vision.entries ?? []
        setParserText(docTextContent(parser))
        setParserMeta({ parser: parser.parser, fromCache: parser.fromCache })
        setVisionEntries(visionRows)
        setView(
          defaultDocViewMode(docRef, hasPdf, {
            hasSpan,
            requested: requestedMode ?? undefined,
            hasVisionText: visionRows.length > 0,
          }),
        )
      })
      .catch(() => setParserText("⚠ failed to load source document"))
  }, [docId, requestedMode, spanStart, spanEnd, hasPdf, docRef?.name, docRef?.type, docTextOpts, linkId])

  return {
    hasPdf,
    parserText,
    parserMeta,
    visionEntries,
    visionIndex,
    setVisionIndex,
    view,
    setView,
  }
}
