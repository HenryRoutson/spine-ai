"use client"

import { useEffect, useState } from "react"
import { defaultDocViewMode } from "@/lib/doc-content"
import type { DocViewMode } from "@/lib/doc-viewer"
import { API_ROUTES } from "@/lib/api-routes"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
import { useDocFetchScope } from "@/lib/use-doc-fetch-scope"
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
  const { docTextOpts, docFileUrl } = useDocFetchScope()
  const [hasPdf, setHasPdf] = useState(false)
  const [parserText, setParserText] = useState<string | null>(null)
  const [parserMeta, setParserMeta] = useState<{ parser?: string; fromCache?: boolean }>({})
  const [visionEntries, setVisionEntries] = useState<VisionEntry[]>([])
  const [visionIndex, setVisionIndex] = useState(0)
  const [view, setView] = useState<DocViewMode>("parser")

  useEffect(() => {
    if (!docId) return
    setParserText(null)
    setParserMeta({})
    setVisionEntries([])
    setVisionIndex(0)
    const hasSpan = spanStart !== spanEnd
    let cancelled = false
    const fileUrl = docFileUrl(docId)
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
      fetch(fileUrl, { method: "HEAD" })
        .then((r) => r.ok)
        .catch(() => false),
    ])
      .then(([parser, vision, pdfAvailable]) => {
        if (cancelled) return
        const visionRows: VisionEntry[] = vision.entries ?? []
        setHasPdf(pdfAvailable)
        setParserText(docTextContent(parser))
        setParserMeta({ parser: parser.parser, fromCache: parser.fromCache })
        setVisionEntries(visionRows)
        setView(
          defaultDocViewMode(docRef, pdfAvailable, {
            hasSpan,
            requested: requestedMode ?? undefined,
            hasVisionText: visionRows.length > 0,
          }),
        )
      })
      .catch(() => {
        if (!cancelled) setParserText("⚠ failed to load source document")
      })
    return () => {
      cancelled = true
    }
  }, [docId, requestedMode, spanStart, spanEnd, docRef?.name, docRef?.type, docTextOpts, docFileUrl])

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
