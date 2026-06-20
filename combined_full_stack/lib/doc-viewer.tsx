"use client"

// AI : validated-text click-to-source overlay state. Quotes carry {docId, start, end}
// AI : character offsets into the stored docs/<hash>.txt; the optional `text` lets the
// AI : viewer fall back to indexOf when offsets went stale (doc re-uploaded).

import { createContext, useContext, useState, type ReactNode } from "react"

export type DocViewMode = "pdf" | "text" | "json"

export interface DocJumpTarget {
  docId: string
  start: number
  end: number
  text?: string // expected quote text — guard rail for stale offsets
  mode?: DocViewMode // AI : force original pdf vs converted text when opening a full doc
}

interface DocViewerState {
  target: DocJumpTarget | null
  open: (t: DocJumpTarget) => void
  close: () => void
}

const DocViewerContext = createContext<DocViewerState | null>(null)

export function DocViewerProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<DocJumpTarget | null>(null)
  return (
    <DocViewerContext.Provider
      value={{
        target,
        open: (t) => setTarget(t),
        close: () => setTarget(null),
      }}
    >
      {children}
    </DocViewerContext.Provider>
  )
}

export function useDocViewer() {
  const ctx = useContext(DocViewerContext)
  if (!ctx) throw new Error("useDocViewer must be used within DocViewerProvider")
  return ctx
}
