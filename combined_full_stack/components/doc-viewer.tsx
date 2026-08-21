"use client"

import { useEffect, useRef, useState } from "react"
import { X, FileText, Pencil } from "lucide-react"
import { useDocViewer, type DocViewMode } from "@/lib/doc-viewer"
import { useOptionalStore } from "@/lib/store"
import { resolveSpan } from "@/lib/doc-span"
import { useDocViewerData } from "@/lib/use-doc-viewer-data"
import { useDocFetchScope } from "@/lib/use-doc-fetch-scope"
import { OpenInDocumentsLink } from "@/components/open-in-documents"
import { DocViewerLoading } from "@/components/doc-viewer-loading"
import { DocEditDialog } from "@/components/doc-edit-dialog"
import { cn } from "@/lib/utils"
import { DataDownloadMenu } from "@/components/data-download-menu"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { MarkupView } from "@/components/highlight"
import { docViewerTabs, docViewTabLabel, isPdfDoc, markupKindForDoc } from "@/lib/doc-content"
import { MarkupKind } from "@/lib/markup-kinds"
import { isTabularDocType } from "@/lib/doc-structure-infer"
import { isStructuredEditableDoc } from "@/lib/doc-edit"
import { isTestingFileName } from "@/lib/testing-files"
import { isInferenceSetupFileName } from "@/lib/inference-setup-files"
import { isDownloadableJson } from "@/lib/json-utils"
import { isPreviewOnly } from "@/lib/demo-mode"
import { PreviewBlockedDialog } from "@/components/preview-blocked-dialog"
import { useOptionalAppShell, AppWindowId } from "@/lib/app-shell"
import { Button } from "@/components/ui/button"
import type { DocId, DocRef } from "@/lib/types"

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

export function DocViewer() {
  const { target, close } = useDocViewer()
  const store = useOptionalStore()
  const shell = useOptionalAppShell()
  const docs = store?.docs ?? []
  const models = store?.models ?? []
  const markRef = useRef<HTMLSpanElement>(null)
  const [editDoc, setEditDoc] = useState<DocRef | null>(null)
  const [previewBlockedOpen, setPreviewBlockedOpen] = useState(false)

  const docId = target?.docId ?? null
  const docRef = docId ? docs.find((d) => d.id === docId) : undefined

  const {
    hasPdf,
    parserText,
    parserMeta,
    visionEntries,
    visionIndex,
    setVisionIndex,
    view,
    setView,
  } = useDocViewerData({
    docId: docId as DocId | null,
    docRef,
    requestedMode: target?.mode ?? null,
    spanStart: target?.start ?? 0,
    spanEnd: target?.end ?? 0,
  })
  const { docFileUrl } = useDocFetchScope()

  const hasVisionText = visionEntries.length > 0
  const tabs = docViewerTabs(docRef, hasPdf, hasVisionText)
  const showPdf = isPdfDoc(docRef, hasPdf)
  const tabularDoc = docRef ? isTabularDocType(docRef.type, docRef.name) : false
  // AI : TODO (media-view-A-docs) — Play tab: <audio>/<video>/gltf from docFileUrl; JSON tab stays.
  const displayText =
    view === "vision" ? (visionEntries[visionIndex]?.text ?? "") : (parserText ?? "")
  const canEdit =
    !!docRef &&
    (isTestingFileName(docRef.name) ||
      isInferenceSetupFileName(docRef.name) ||
      isStructuredEditableDoc(docRef))

  function startEdit() {
    if (!docRef) return
    if (isPreviewOnly()) {
      setPreviewBlockedOpen(true)
      return
    }
    if (isTestingFileName(docRef.name)) {
      shell?.openTesting(docRef.name)
      close()
      return
    }
    if (isInferenceSetupFileName(docRef.name)) {
      shell?.setActiveWindow(AppWindowId.Inference)
      close()
      return
    }
    setEditDoc(docRef)
  }

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
    <>
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
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 bg-transparent"
                onClick={startEdit}
                title="Edit as a new file"
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
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
          // AI : TODO security — same-origin inline PDF iframe; sandbox viewer or attachment disposition.
          <iframe
            src={docFileUrl(target.docId)}
            title={`PDF ${target.docId}`}
            className="min-h-0 flex-1 bg-white"
          />
        ) : view === "json" ? (
          parserText === null ? (
            <DocViewerLoading />
          ) : (
            <JsonPreviewPanel
              json={parserText}
              doc={docRef}
              models={models}
              defaultView={tabularDoc ? "table" : undefined}
              className="min-h-0 flex-1"
            />
          )
        ) : view === "formatted" ? (
          <div className="flex-1 overflow-auto px-6 py-5">
            {parserText === null ? (
              <DocViewerLoading />
            ) : (
              <MarkupView kind={markupKindForDoc(docRef) ?? MarkupKind.Markdown} source={parserText} />
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
            {view === "parser" && parserText !== null && isDownloadableJson(parserText) ? (
              <div className="flex justify-end border-b border-border bg-secondary/20 px-4 py-2.5">
                <DataDownloadMenu content={parserText} models={models} />
              </div>
            ) : null}
            <div className="flex-1 overflow-auto px-6 py-5">
              {parserText === null && view !== "vision" ? (
                <DocViewerLoading />
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
    {previewBlockedOpen ? <PreviewBlockedDialog onClose={() => setPreviewBlockedOpen(false)} /> : null}
    {editDoc ? (
      <DocEditDialog
        doc={editDoc}
        onClose={() => setEditDoc(null)}
        onSaved={() => {
          setEditDoc(null)
        }}
      />
    ) : null}
    </>
  )
}
