"use client"

import { Files } from "lucide-react"
import { useOptionalStore } from "@/lib/store"
import { useAppShell } from "@/lib/app-shell"
import { cn } from "@/lib/utils"
import type { DocId } from "@/lib/types"

export function OpenInDocumentsLink({
  docId,
  label = "documents",
  className,
  stopPropagation = true,
  variant = "inline",
}: {
  docId?: DocId
  label?: string
  className?: string
  stopPropagation?: boolean
  variant?: "inline" | "source"
}) {
  const store = useOptionalStore()
  const { openDocuments } = useAppShell()

  const resolvedLabel =
    variant === "source" && docId
      ? `from ${store?.docs.find((d) => d.id === docId)?.name ?? docId.slice(0, 8)}`
      : label

  return (
    <button
      type="button"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation()
        openDocuments(docId)
      }}
      className={cn(
        variant === "source"
          ? "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          : "inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-primary",
        className,
      )}
      title={
        variant === "source"
          ? "Open source document in Documents tab"
          : "Open in the Documents store"
      }
    >
      <Files className="h-3 w-3 shrink-0" />
      <span className={variant === "source" ? "truncate" : undefined}>{resolvedLabel}</span>
    </button>
  )
}
