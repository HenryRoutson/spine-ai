"use client"

// AI : shell navigation — lets Inference/Logging jump to Documents and focus a stored hash.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { openLlmProvidersSettings, scrollToSettingsSection } from "@/lib/settings-nav"
import type { SharedRunDocScope } from "@/lib/shared-run-doc-scope"
import type { DocId, StructureModelId } from "@/lib/types"

export type AppWindowId =
  | "structure"
  | "pipeline"
  | "retrieval"
  | "testing"
  | "inference"
  | "share"
  | "earnings"
  | "logging"
  | "cache"
  | "documents"
  | "docs"
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
  activeSharedLinkId: string | null
  openSharedRun: (linkId: string) => void
  clearSharedRun: () => void
  sharedRunDocScope: SharedRunDocScope | null
  setSharedRunDocScope: (scope: SharedRunDocScope | null) => void
  openSettingsSection: (sectionId: string) => void
  pendingLlmProvidersOpen: boolean
  clearPendingLlmProvidersOpen: () => void
}

const AppShellContext = createContext<AppShellState | null>(null)

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [activeWindow, setActiveWindow] = useState<AppWindowId>("structure")
  const [focusDocId, setFocusDocId] = useState<DocId | null>(null)
  const [focusRunId, setFocusRunId] = useState<string | null>(null)
  const [focusStructureId, setFocusStructureId] = useState<StructureModelId | null>(null)
  const [activeSharedLinkId, setActiveSharedLinkId] = useState<string | null>(null)
  const [sharedRunDocScope, setSharedRunDocScope] = useState<SharedRunDocScope | null>(null)
  const [pendingLlmProvidersOpen, setPendingLlmProvidersOpen] = useState(false)

  const openSharedRun = useCallback((linkId: string) => {
    setActiveSharedLinkId(linkId)
    setActiveWindow("share")
  }, [])

  const clearSharedRun = useCallback(() => setActiveSharedLinkId(null), [])

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

  const clearPendingLlmProvidersOpen = useCallback(() => setPendingLlmProvidersOpen(false), [])

  const openSettingsSection = useCallback((sectionId: string) => {
    setActiveWindow("settings")
    if (sectionId === "settings-llm-providers") {
      setPendingLlmProvidersOpen(true)
      window.setTimeout(() => openLlmProvidersSettings(), 50)
      return
    }
    window.setTimeout(() => scrollToSettingsSection(sectionId), 50)
  }, [])

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
        activeSharedLinkId,
        openSharedRun,
        clearSharedRun,
        sharedRunDocScope,
        setSharedRunDocScope,
        openSettingsSection,
        pendingLlmProvidersOpen,
        clearPendingLlmProvidersOpen,
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
