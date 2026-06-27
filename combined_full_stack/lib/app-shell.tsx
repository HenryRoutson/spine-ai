"use client"

// AI : shell navigation — lets Inference/Logging jump to Documents and focus a stored hash.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import type { DocId, StructureModelId } from "@/lib/types"

export type AppWindowId =
  | "projects"
  | "structure"
  | "pipeline"
  | "inference"
  | "logging"
  | "cache"
  | "documents"
  | "billing"
  | "settings"

interface AppShellState {
  activeWindow: AppWindowId
  setActiveWindow: (window: AppWindowId) => void
  focusDocId: DocId | null
  openDocuments: (docId?: DocId) => void
  clearFocusDoc: () => void
  focusRunId: string | null
  openLogging: (runId?: string) => void
  clearFocusRun: () => void
  focusStructureId: StructureModelId | null
  openStructure: (structureId?: StructureModelId) => void
  clearFocusStructure: () => void
}

const AppShellContext = createContext<AppShellState | null>(null)

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [activeWindow, setActiveWindow] = useState<AppWindowId>("structure")
  const [focusDocId, setFocusDocId] = useState<DocId | null>(null)
  const [focusRunId, setFocusRunId] = useState<string | null>(null)
  const [focusStructureId, setFocusStructureId] = useState<StructureModelId | null>(null)

  const openDocuments = useCallback((docId?: DocId) => {
    setFocusDocId(docId ?? null)
    setActiveWindow("documents")
  }, [])

  const clearFocusDoc = useCallback(() => setFocusDocId(null), [])

  const openLogging = useCallback((runId?: string) => {
    setFocusRunId(runId ?? null)
    setActiveWindow("logging")
  }, [])

  const clearFocusRun = useCallback(() => setFocusRunId(null), [])

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
        focusRunId,
        openLogging,
        clearFocusRun,
        focusStructureId,
        openStructure,
        clearFocusStructure,
      }}
    >
      {children}
    </AppShellContext.Provider>
  )
}

export function useOptionalAppShell() {
  return useContext(AppShellContext)
}

export function useAppShell() {
  const ctx = useOptionalAppShell()
  if (!ctx) throw new Error("useAppShell must be used within AppShellProvider")
  return ctx
}
