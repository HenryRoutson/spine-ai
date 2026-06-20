"use client"

import { Files } from "lucide-react"
import { useAppShell } from "@/lib/app-shell"
import { cn } from "@/lib/utils"
import type { DocId } from "@/lib/types"

export function OpenInDocumentsLink({
  docId,
  label = "documents",
  className,
  stopPropagation = true,
}: {
  docId: DocId
  label?: string
  className?: string
  stopPropagation?: boolean
}) {
  const { openDocuments } = useAppShell()

  return (
    <button
      type="button"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation()
        openDocuments(docId)
      }}
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-primary",
        className,
      )}
      title="Open in the Documents store"
    >
      <Files className="h-3 w-3 shrink-0" />
      {label}
    </button>
  )
}
