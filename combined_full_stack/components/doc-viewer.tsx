"use client"

import { useEffect, useRef, useState } from "react"
import { X, FileText, Loader2 } from "lucide-react"
import { useDocViewer, type DocViewMode } from "@/lib/doc-viewer"
import { useStore } from "@/lib/store"
import { OpenInDocumentsLink } from "@/components/open-in-documents"
import { cn } from "@/lib/utils"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { MarkdownView } from "@/components/highlight"
import { defaultDocViewMode, docViewerTabs, docViewTabLabel, isPdfDoc } from "@/lib/doc-content"
import { API_ROUTES } from "@/lib/api-routes"
import type { DocId, DocRef } from "@/lib/types"

// AI : de-mocked — source text comes from GET /api/docs/:id/text (the stored content-hash
// AI : file), not the hardcoded LEGAL_SOURCE_TEXT. Offsets are validated with an indexOf
// AI : fallback when the expected quote text no longer matches (stale offsets guard rail).
function resolveSpan(text: string, start: number, end: number, expected?: string): { start: number; end: number } {
  if (start === end) return { start, end }
  if (!expected || text.slice(start, end) === expected) return { start, end }
  const idx = text.indexOf(expected)
  if (idx !== -1) return { start: idx, end: idx + expected.length }
  return { start: 0, end: 0 } // offsets unrecoverable — show the doc un-highlighted
}

const TAB_LABEL: Record<DocViewMode, string> = {
  parser: "built-in",
  vision: "vision OCR",
  formatted: "formatted",
  pdf: "pdf",
  json: "json",
}

function tabLabel(mode: DocViewMode, doc: Pick<DocRef, "name" | "type"> | undefined, hasPdf: boolean): string {
  return doc ? docViewTabLabel(mode, doc, hasPdf) : TAB_LABEL[mode]
}

type VisionEntry = { key: string; model: string; text: string; createdAt: number }

export function DocViewer() {
  const { target, close } = useDocViewer()
  const { docs } = useStore()
  const markRef = useRef<HTMLSpanElement>(null)
  const [parserText, setParserText] = useState<string | null>(null)
  const [parserMeta, setParserMeta] = useState<{ parser?: string; fromCache?: boolean }>({})
  const [visionEntries, setVisionEntries] = useState<VisionEntry[]>([])
  const [visionIndex, setVisionIndex] = useState(0)
  const [view, setView] = useState<DocViewMode>("parser")

  const docId = target?.docId ?? null
  const spanStart = target?.start ?? 0
  const spanEnd = target?.end ?? 0
  const requestedMode = target?.mode ?? null
  const docRef = docId ? docs.find((d) => d.id === docId) : undefined
  const docName = docRef?.name ?? null
  const docType = docRef?.type ?? null
  const [hasPdf, setHasPdf] = useState(false)
  const hasVisionText = visionEntries.length > 0
  const tabs = docViewerTabs(docRef, hasPdf, hasVisionText)
  const showPdf = isPdfDoc(docRef, hasPdf)
  const displayText =
    view === "vision" ? (visionEntries[visionIndex]?.text ?? "") : (parserText ?? "")

  // AI : TODO refactor (prod) — PDF tab depends on /file bytes; fix when Supabase Storage ships (store.ts).
  useEffect(() => {
    if (!docId) return
    setHasPdf(false)
    fetch(API_ROUTES.docFile(docId), { method: "HEAD" })
      .then((r) => setHasPdf(r.ok))
      .catch(() => setHasPdf(false))
  }, [docId])

  useEffect(() => {
    if (!docId) return
    setParserText(null)
    setParserMeta({})
    setVisionEntries([])
    setVisionIndex(0)
    const hasSpan = spanStart !== spanEnd
    let visionRows: VisionEntry[] = []
    Promise.all([
      fetch(API_ROUTES.docText(docId, "parser")).then((r) =>
        r.ok ? r.json() : { text: `⚠ source not found for ${docId}` },
      ),
      fetch(API_ROUTES.docText(docId, "vision")).then((r) =>
        r.ok ? r.json() : { entries: [] as VisionEntry[] },
      ),
    ])
      .then(([parser, vision]) => {
        visionRows = vision.entries ?? []
        setParserText(parser.text ?? "")
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
  }, [docId, requestedMode, spanStart, spanEnd, hasPdf, docName, docType])

  useEffect(() => {
    if (!docId || parserText === null || view !== "parser" || !markRef.current) return
    markRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [docId, parserText, view])

  useEffect(() => {
    if (!docId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [docId, close])

  if (!target) return null
  const span =
    parserText !== null && view === "parser"
      ? resolveSpan(parserText, target.start, target.end, target.text)
      : { start: 0, end: 0 }
  const before = displayText.slice(0, span.start)
  const quote = displayText.slice(span.start, span.end)
  const after = displayText.slice(span.end)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close document viewer"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={close}
      />
      <aside
        className={cn(
          "relative flex h-full w-full flex-col border-l border-border bg-card shadow-xl",
          view === "pdf" ? "max-w-3xl" : view === "json" ? "max-w-5xl" : view === "formatted" ? "max-w-2xl" : "max-w-xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <div className="leading-tight">
              <p className="text-sm font-semibold">{docRef?.name ?? "Source Document"}</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {target.docId}
                {span.start !== span.end ? ` · offset ${span.start}–${span.end}` : showPdf ? " · original PDF" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tabs.length > 0 && (
              <div className="flex rounded-md border border-border p-0.5">
                {tabs.map((m) => (
                  <button
                    key={m}
                    onClick={() => setView(m)}
                    className={cn(
                      "rounded px-2 py-1 font-mono text-[10px] transition-colors",
                      view === m ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tabLabel(m, docRef, hasPdf)}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={close}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {view === "pdf" ? (
          // AI: browser-native PDF viewer over the stored original (GET /api/docs/:id/file).
          <iframe
            src={API_ROUTES.docFile(target.docId)}
            title={`PDF ${target.docId}`}
            className="min-h-0 flex-1 bg-white"
          />
        ) : view === "json" ? (
          parserText === null ? (
            <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-mono text-[11px]">loading source…</span>
            </div>
          ) : (
            // AI: full interactive viewer — tree / table modes via the embedded iframe
            <JsonPreviewPanel json={parserText} className="min-h-0 flex-1" />
          )
        ) : view === "formatted" ? (
          <div className="flex-1 overflow-auto px-6 py-5">
            {parserText === null ? (
              <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-mono text-[11px]">loading source…</span>
              </div>
            ) : (
              <MarkdownView md={parserText} />
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {view === "vision" && visionEntries.length > 1 ? (
              <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
                {visionEntries.map((entry, i) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setVisionIndex(i)}
                    className={cn(
                      "rounded border px-2 py-0.5 font-mono text-[10px]",
                      i === visionIndex
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {entry.model}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex-1 overflow-auto px-6 py-5">
              {parserText === null && view !== "vision" ? (
                <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-mono text-[11px]">loading source…</span>
                </div>
              ) : view === "vision" && !visionEntries.length ? (
                <p className="font-mono text-[11px] text-muted-foreground">no vision OCR cached for this document</p>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-muted-foreground">
                  {view === "parser" ? before : null}
                  {view === "parser" && quote ? (
                    <span
                      ref={markRef}
                      className="rounded bg-primary/25 px-0.5 font-medium text-foreground ring-1 ring-primary/50"
                    >
                      {quote}
                    </span>
                  ) : null}
                  {view === "parser" ? after : displayText}
                </pre>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-5 py-2.5 font-mono text-[10px] text-muted-foreground">
          <span>
            {view === "pdf"
              ? "original document — stored beside built-in parser text"
              : view === "json"
                ? "interactive JSON viewer — tree · table"
                : view === "formatted"
                  ? "formatted markdown — rendered via GFM (tables, lists, code, links)"
                  : view === "vision"
                    ? `vision OCR — ${visionEntries[visionIndex]?.model ?? "—"}${visionEntries.length ? " (cached)" : ""}`
                    : showPdf
                      ? `raw markdown — ${parserMeta.parser ?? "pdf.js"}${parserMeta.fromCache ? " (cached)" : ""}`
                      : `built-in parser — ${parserMeta.parser ?? "upload"}${parserMeta.fromCache ? " (cached)" : ""}`}
          </span>
          <OpenInDocumentsLink docId={target.docId as DocId} label="saved in documents" className="shrink-0" />
        </div>
      </aside>
    </div>
  )
}
