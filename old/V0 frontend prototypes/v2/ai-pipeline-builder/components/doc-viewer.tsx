"use client"

import { useEffect, useRef } from "react"
import { X, FileText } from "lucide-react"
import { useDocViewer } from "@/lib/doc-viewer"
import { LEGAL_SOURCE_TEXT } from "@/lib/store"

// For the demo all source-quote jumps resolve to the seed legal document.
function sourceFor(_docId: string) {
  return LEGAL_SOURCE_TEXT
}

export function DocViewer() {
  const { target, close } = useDocViewer()
  const markRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (target && markRef.current) {
      markRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [target])

  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [target, close])

  if (!target) return null
  const text = sourceFor(target.docId)
  const before = text.slice(0, target.start)
  const quote = text.slice(target.start, target.end)
  const after = text.slice(target.end)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close document viewer"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={close}
      />
      <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <div className="leading-tight">
              <p className="text-sm font-semibold">Source Document</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {target.docId} · offset {target.start}–{target.end}
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-5">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-muted-foreground">
            {before}
            <span
              ref={markRef}
              className="rounded bg-primary/25 px-0.5 font-medium text-foreground ring-1 ring-primary/50"
            >
              {quote}
            </span>
            {after}
          </pre>
        </div>
        <div className="border-t border-border px-5 py-2.5 font-mono text-[10px] text-muted-foreground">
          validated text — extracted span linked to source via langextract-style offsets
        </div>
      </aside>
    </div>
  )
}
