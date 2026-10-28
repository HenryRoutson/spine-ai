"use client"

import { useMemo } from "react"
import { FileText, Maximize2 } from "lucide-react"
import { useDocViewer } from "@/lib/doc-viewer"
import { docsForProject } from "@/lib/project-docs"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { DocId } from "@/lib/types"

type AgentBrowsePanelProps = {
  className?: string
  /** AI : compact for dock dropdown; sidebar can scroll longer. */
  maxDocRows?: number
  /** AI : close dock popover after open. */
  onAction?: () => void
}

// AI : Vibe / Agent — project docs only; Maximize opens DocViewer.
export function AgentBrowsePanel({ className, maxDocRows = 24, onAction }: AgentBrowsePanelProps) {
  const { docs, project } = useStore()
  const { open } = useDocViewer()
  const projectDocs = useMemo(() => docsForProject(docs, project), [docs, project])
  const shown = projectDocs.slice(0, maxDocRows)

  function openDoc(docId: DocId) {
    open({ docId, start: 0, end: 0 })
    onAction?.()
  }

  return (
    <div className={cn("space-y-1", className)}>
      <p className="px-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        Files
      </p>
      {shown.length === 0 ? (
        <p className="px-0.5 font-mono text-[10px] text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-0.5">
          {shown.map((doc) => (
            <li key={doc.id}>
              <div className="group flex items-center gap-0.5 rounded-md border border-transparent hover:border-border hover:bg-secondary/40">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-left"
                  onClick={() => openDoc(doc.id)}
                  title={doc.name}
                >
                  <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono text-[10px] text-foreground">{doc.name}</span>
                </button>
                <button
                  type="button"
                  className="mr-0.5 shrink-0 rounded p-1 text-muted-foreground opacity-70 hover:bg-background/80 hover:text-foreground group-hover:opacity-100"
                  aria-label={`View ${doc.name} full screen`}
                  title="View full screen"
                  onClick={() => openDoc(doc.id)}
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {projectDocs.length > maxDocRows ? (
        <p className="px-0.5 font-mono text-[9px] text-muted-foreground">
          +{projectDocs.length - maxDocRows}
        </p>
      ) : null}
    </div>
  )
}
