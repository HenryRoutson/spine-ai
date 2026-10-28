"use client"

import { FileText, Link2 } from "lucide-react"
import { useDocViewer } from "@/lib/doc-viewer"
import { OpenInDocumentsLink } from "@/components/open-in-documents"
import type { DocRef } from "@/lib/types"

export function InputDocumentLink({ doc, className }: { doc: DocRef; className?: string }) {
  const { open } = useDocViewer()

  return (
    <div
      className={
        className ??
        "flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5"
      }
    >
      <FileText className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">input document</p>
        <p className="truncate text-sm font-medium">{doc.name}</p>
        <OpenInDocumentsLink docId={doc.id} label={doc.id} className="mt-0.5 text-muted-foreground/80" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={() => open({ docId: doc.id, start: 0, end: 0 })}
          className="inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
          title="Open the input document used for this run"
        >
          <Link2 className="h-3 w-3" />
          view original
        </button>
        <OpenInDocumentsLink docId={doc.id} label="open in documents" className="text-primary/80" />
      </div>
    </div>
  )
}
