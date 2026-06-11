"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export interface DocJumpTarget {
  docId: string
  start: number
  end: number
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
