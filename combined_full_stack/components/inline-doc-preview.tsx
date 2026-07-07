"use client"

import { useEffect, useState } from "react"
import { DocViewerLoading } from "@/components/doc-viewer-loading"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { MarkdownView } from "@/components/highlight"
import {
  defaultInlineDocViewMode,
  docViewTabLabel,
  inlineDocViewTabs,
  isPdfDoc,
} from "@/lib/doc-content"
import type { DocViewMode } from "@/lib/doc-viewer"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
import { useDocFetchScope } from "@/lib/use-doc-fetch-scope"
import { cn } from "@/lib/utils"
import { isTabularDocType } from "@/lib/doc-structure-infer"
import type { DocId, DocRef, StructureModel } from "@/lib/types"

type InlineDocPreviewProps = {
  docId: DocId
  doc?: Pick<DocRef, "id" | "name" | "type">
  models?: StructureModel[]
  className?: string
  maxHeightClass?: string
}

export function InlineDocPreview({
  docId,
  doc,
  models,
  className,
  maxHeightClass = "max-h-72",
}: InlineDocPreviewProps) {
  const { docTextOpts, docFileUrl } = useDocFetchScope()
  const [hasPdf, setHasPdf] = useState(false)
  const [parserText, setParserText] = useState<string | null>(null)
  const [view, setView] = useState<DocViewMode>("parser")

  useEffect(() => {
    const ctrl = new AbortController()
    setHasPdf(false)
    fetch(docFileUrl(docId), {
      method: "HEAD",
      signal: ctrl.signal,
    })
      .then((r) => setHasPdf(r.ok))
      .catch(() => {
        if (!ctrl.signal.aborted) setHasPdf(false)
      })
    return () => ctrl.abort()
  }, [docId, docFileUrl])

  useEffect(() => {
    const ctrl = new AbortController()
    let cancelled = false
    setParserText(null)
    fetchDocText(docId, "parser", docTextOpts)
      .then((parser) => {
        if (cancelled) return
        const text =
          parser.text !== undefined || parser.content !== undefined
            ? docTextContent(parser)
            : `⚠ source not found for ${docId}`
        setParserText(text)
        setView(defaultInlineDocViewMode(doc, hasPdf))
      })
      .catch(() => {
        if (!cancelled) setParserText("⚠ failed to load source document")
      })
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [docId, doc?.name, doc?.type, hasPdf, docTextOpts, docFileUrl])

  const tabs = inlineDocViewTabs(doc, hasPdf)
  const showPdf = isPdfDoc(doc, hasPdf)
  const tabularDoc = doc ? isTabularDocType(doc.type, doc.name) : false

  return (
    <div
      className={cn("overflow-hidden rounded border border-border/60 bg-background/40", className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {tabs.length > 1 ? (
        <div className="flex border-b border-border/60 bg-muted/20 px-2 py-1">
          {tabs.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={cn(
                "rounded px-2 py-0.5 font-mono text-[10px] transition-colors",
                view === mode ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {docViewTabLabel(mode, doc, hasPdf)}
            </button>
          ))}
        </div>
      ) : null}
      <div className={cn("overflow-auto", maxHeightClass)}>
        {parserText === null ? (
          <div className="py-6">
            <DocViewerLoading />
          </div>
        ) : view === "json" ? (
          <JsonPreviewPanel
            json={parserText}
            doc={doc}
            models={models}
            defaultView={tabularDoc ? "table" : undefined}
            className="min-h-0"
          />
        ) : view === "formatted" ? (
          <div className="px-3 py-2.5">
            <MarkdownView md={parserText} />
          </div>
        ) : (
          <pre className="whitespace-pre-wrap px-3 py-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {parserText}
          </pre>
        )}
      </div>
      <div className="border-t border-border/60 px-2 py-1 font-mono text-[9px] text-muted-foreground/80">
        {view === "json"
          ? tabularDoc
            ? "table view — excel/json"
            : "json view"
          : view === "formatted"
            ? "formatted markdown"
            : showPdf
              ? "raw text — converted from pdf"
              : "built-in parser text"}
      </div>
    </div>
  )
}
