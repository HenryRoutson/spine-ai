"use client"

import { useEffect, useRef, useState } from "react"
import { X, FileText, Loader2 } from "lucide-react"
import { useDocViewer } from "@/lib/doc-viewer"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { JsonViewerEmbed } from "@/components/json-viewer"

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

type ViewMode = "text" | "pdf" | "json"

export function DocViewer() {
  const { target, close } = useDocViewer()
  const { docs } = useStore()
  const markRef = useRef<HTMLSpanElement>(null)
  const [text, setText] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>("text")

  const docType = target ? docs.find((d) => d.id === target.docId)?.type : undefined
  const isPdf  = docType === "pdf"
  const isJson = docType === "json"

  useEffect(() => {
    if (!target) return
    setText(null)
    // AI: JSON docs default to the interactive viewer; PDFs open as PDF when no selection
    setView(isJson ? "json" : isPdf && target.start === target.end ? "pdf" : "text")
    fetch(`/api/docs/${target.docId}/text`)
      .then((r) => (r.ok ? r.json() : { text: `⚠ source not found for ${target.docId}` }))
      .then((d) => setText(d.text))
      .catch(() => setText("⚠ failed to load source document"))
  }, [target?.docId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (target && text !== null && markRef.current) {
      markRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [target, text])

  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [target, close])

  if (!target) return null
  const span = text !== null ? resolveSpan(text, target.start, target.end, target.text) : { start: 0, end: 0 }
  const before = text?.slice(0, span.start) ?? ""
  const quote = text?.slice(span.start, span.end) ?? ""
  const after = text?.slice(span.end) ?? ""

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
          view === "pdf" ? "max-w-3xl" : view === "json" ? "max-w-5xl" : "max-w-xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <div className="leading-tight">
              <p className="text-sm font-semibold">Source Document</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {target.docId} · offset {span.start}–{span.end}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(isPdf || isJson) && (
              <div className="flex rounded-md border border-border p-0.5">
                {(isJson ? (["json", "text"] as const) : (["text", "pdf"] as const)).map((m) => (
                  <button
                    key={m}
                    onClick={() => setView(m as ViewMode)}
                    className={cn(
                      "rounded px-2 py-1 font-mono text-[10px] transition-colors",
                      view === m ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m}
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
            src={`/api/docs/${target.docId}/file`}
            title={`PDF ${target.docId}`}
            className="min-h-0 flex-1 bg-white"
          />
        ) : view === "json" ? (
          text === null ? (
            <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-mono text-[11px]">loading source…</span>
            </div>
          ) : (
            // AI: full interactive viewer — tree / table modes via the embedded iframe
            <JsonViewerEmbed json={text} className="min-h-0 flex-1" />
          )
        ) : (
          <div className="flex-1 overflow-auto px-6 py-5">
            {text === null ? (
              <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-mono text-[11px]">loading source…</span>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-muted-foreground">
                {before}
                {quote && (
                  <span
                    ref={markRef}
                    className="rounded bg-primary/25 px-0.5 font-medium text-foreground ring-1 ring-primary/50"
                  >
                    {quote}
                  </span>
                )}
                {after}
              </pre>
            )}
          </div>
        )}
        <div className="border-t border-border px-5 py-2.5 font-mono text-[10px] text-muted-foreground">
          {view === "pdf"
            ? "original document — stored beside its content-hashed extracted text"
            : view === "json"
            ? "interactive JSON viewer — tree · table"
            : "validated text — extracted span linked to source via langextract-style offsets"}
        </div>
      </aside>
    </div>
  )
}
