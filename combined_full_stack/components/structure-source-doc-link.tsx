"use client"

import { useStore } from "@/lib/store"
import { useAppShell } from "@/lib/app-shell"
import { cn } from "@/lib/utils"
import type { DocId } from "@/lib/types"
import { Files } from "lucide-react"

// AI : structure tab — link back to the source document a derived model came from.
export function StructureSourceDocLink({
  sourceDocId,
  className,
}: {
  sourceDocId?: DocId
  className?: string
}) {
  const { docs } = useStore()
  const { openDocuments } = useAppShell()
  if (!sourceDocId) return null

  const doc = docs.find((d) => d.id === sourceDocId)
  const label = doc?.name ?? sourceDocId.slice(0, 8)

  return (
    <button
      type="button"
      onClick={() => openDocuments(sourceDocId)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary",
        className,
      )}
      title="Open source document in Documents tab"
    >
      <Files className="h-3 w-3 shrink-0" />
      <span className="truncate">from {label}</span>
    </button>
  )
}
