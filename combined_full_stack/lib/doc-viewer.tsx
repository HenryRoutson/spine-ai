"use client"

// AI : validated-text click-to-source overlay state. Quotes carry {docId, start, end}
// AI : character offsets into the stored docs/<hash>.txt; the optional `text` lets the
// AI : viewer fall back to indexOf when offsets went stale (doc re-uploaded).

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

export const DocViewMode = {
  Pdf: "pdf",
  Parser: "parser",
  Vision: "vision",
  Json: "json",
  Formatted: "formatted",
} as const

export type DocViewMode = (typeof DocViewMode)[keyof typeof DocViewMode]

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
  const open = useCallback((t: DocJumpTarget) => setTarget(t), [])
  const close = useCallback(() => setTarget(null), [])
  const value = useMemo(() => ({ target, open, close }), [target, open, close])
  return <DocViewerContext.Provider value={value}>{children}</DocViewerContext.Provider>
}

export function useDocViewer() {
  const ctx = useContext(DocViewerContext)
  if (!ctx) throw new Error("useDocViewer must be used within DocViewerProvider")
  return ctx
}
