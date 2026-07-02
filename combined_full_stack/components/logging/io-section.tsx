"use client"

import { Maximize2, Link2 } from "lucide-react"
import { useDocViewer, type DocViewMode } from "@/lib/doc-viewer"
import { OpenInDocumentsLink } from "@/components/open-in-documents"
import { cn } from "@/lib/utils"
import type { DocId } from "@/lib/types"

export function IoSection({
  title,
  qualifier,
  summary,
  children,
  onExpand,
  docLink,
  bodyClickable,
  className,
}: {
  title: string
  qualifier: "input" | "output" | "error"
  summary?: string
  children?: React.ReactNode
  onExpand?: () => void
  docLink?: { docId: DocId; mode: DocViewMode; label: string }
  bodyClickable?: boolean
  className?: string
}) {
  const { open } = useDocViewer()
  const clickable = bodyClickable !== false && !!docLink

  function openDoc() {
    if (!docLink) return
    open({ docId: docLink.docId, start: 0, end: 0, mode: docLink.mode })
  }

  return (
    <div className={cn("mt-2 pl-7", className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {title}{" "}
          <span className="normal-case text-muted-foreground/70">({qualifier})</span>
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {summary &&
            (docLink ? (
              <button
                type="button"
                onClick={openDoc}
                className="max-w-[220px] truncate font-mono text-[10px] text-primary hover:underline"
                title={docLink.label}
              >
                {summary}
              </button>
            ) : (
              <span className="max-w-[200px] truncate font-mono text-[10px] text-muted-foreground/80">
                {summary}
              </span>
            ))}
          {docLink && (
            <>
              <button
                type="button"
                onClick={openDoc}
                className="inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
              >
                <Link2 className="h-3 w-3" />
                {docLink.label}
              </button>
              <OpenInDocumentsLink docId={docLink.docId} label="store" />
            </>
          )}
          {onExpand && (
            <button
              onClick={onExpand}
              className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Open in full-screen viewer"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {clickable ? (
        <div
          role="button"
          tabIndex={0}
          onClick={openDoc}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              openDoc()
            }
          }}
          className="cursor-pointer rounded border border-border bg-muted/20 p-2 font-mono text-[10px] leading-snug whitespace-pre-wrap text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          {children}
        </div>
      ) : (
        <div className="rounded border border-border bg-muted/20 p-2 font-mono text-[10px] leading-snug whitespace-pre-wrap text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  )
}
