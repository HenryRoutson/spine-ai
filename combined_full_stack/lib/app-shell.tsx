"use client"

// AI : shell navigation — lets Inference/Logging jump to Documents and focus a stored hash.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import type { DocId, StructureModelId } from "@/lib/types"

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
  focusStructureId: StructureModelId | null
  openStructure: (structureId?: StructureModelId) => void
  clearFocusStructure: () => void
}

const AppShellContext = createContext<AppShellState | null>(null)

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [activeWindow, setActiveWindow] = useState<AppWindowId>("structure")
  const [focusDocId, setFocusDocId] = useState<DocId | null>(null)
  const [focusStructureId, setFocusStructureId] = useState<StructureModelId | null>(null)

  const openDocuments = useCallback((docId?: DocId) => {
    setFocusDocId(docId ?? null)
    setActiveWindow("documents")
  }, [])

  const clearFocusDoc = useCallback(() => setFocusDocId(null), [])

  const openStructure = useCallback((structureId?: StructureModelId) => {
    setFocusStructureId(structureId ?? null)
    setActiveWindow("structure")
  }, [])

  const clearFocusStructure = useCallback(() => setFocusStructureId(null), [])

  return (
    <AppShellContext.Provider
      value={{
        activeWindow,
        setActiveWindow,
        focusDocId,
        openDocuments,
        clearFocusDoc,
        focusStructureId,
        openStructure,
        clearFocusStructure,
      }}
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
