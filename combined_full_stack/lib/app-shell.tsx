"use client"

// AI : shell navigation — lets Inference/Logging jump to Documents and focus a stored hash.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import type { DocId } from "@/lib/types"

export type AppWindowId =
  | "structure"
  | "pipeline"
  | "inference"
  | "logging"
  | "documents"
  | "billing"
  | "settings"

interface AppShellState {
  activeWindow: AppWindowId
  setActiveWindow: (window: AppWindowId) => void
  focusDocId: DocId | null
  openDocuments: (docId?: DocId) => void
  clearFocusDoc: () => void
}

const AppShellContext = createContext<AppShellState | null>(null)

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [activeWindow, setActiveWindow] = useState<AppWindowId>("structure")
  const [focusDocId, setFocusDocId] = useState<DocId | null>(null)

  const openDocuments = useCallback((docId?: DocId) => {
    setFocusDocId(docId ?? null)
    setActiveWindow("documents")
  }, [])

  const clearFocusDoc = useCallback(() => setFocusDocId(null), [])

  return (
    <AppShellContext.Provider
      value={{ activeWindow, setActiveWindow, focusDocId, openDocuments, clearFocusDoc }}
    >
      {children}
    </AppShellContext.Provider>
  )
}

export function useAppShell() {
  const ctx = useContext(AppShellContext)
  if (!ctx) throw new Error("useAppShell must be used within AppShellProvider")
  return ctx
}
