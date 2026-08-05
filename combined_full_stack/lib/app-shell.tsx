"use client"

// AI : shell navigation — lets Inference/Logging jump to Documents and focus a stored hash.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import {
  BUILDER_AREAS,
  CONSUMER_AREAS,
  defaultWindowForArea,
  isBuildStep,
  windowToArea,
  type AppArea,
} from "@/lib/app-nav-config"
import { openLlmProvidersSettings, scrollToSettingsSection } from "@/lib/settings-nav"
import type { SharedRunDocScope } from "@/lib/shared-run-doc-scope"
import type { DocId, StructureModelId } from "@/lib/types"

export type LoggingFocusAnchor = "validation-errors"

export type LoggingFocus = {
  runId?: string
  anchor?: LoggingFocusAnchor
}

export type { AppArea } from "@/lib/app-nav-config"
export { windowToArea, isBuildStep } from "@/lib/app-nav-config"

export type AppWindowId =
  | "structure"
  | "pipeline"
  | "testing"
  | "inference"
  | "share"
  | "earnings"
  | "logging"
  | "cache"
  | "documents"
  | "docs"
  | "project-billing"
  | "project-settings"
  | "billing"
  | "settings"

interface AppShellState {
  activeWindow: AppWindowId
  setActiveWindow: (window: AppWindowId) => void
  setActiveArea: (area: AppArea, consumer?: boolean) => void
  focusDocId: DocId | null
  openDocuments: (docId?: DocId) => void
  clearFocusDoc: () => void
  focusRunId: string | null
  focusRunAnchor: LoggingFocusAnchor | null
  openLogging: (focus?: string | LoggingFocus) => void
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
  focusTestDocName: string | null
  openTesting: (testDocName?: string) => void
  clearFocusTestDoc: () => void
}

const AppShellContext = createContext<AppShellState | null>(null)

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [activeWindow, setActiveWindow] = useState<AppWindowId>("structure")
  const [focusDocId, setFocusDocId] = useState<DocId | null>(null)
  const [focusRunId, setFocusRunId] = useState<string | null>(null)
  const [focusRunAnchor, setFocusRunAnchor] = useState<LoggingFocusAnchor | null>(null)
  const [focusStructureId, setFocusStructureId] = useState<StructureModelId | null>(null)
  const [activeSharedLinkId, setActiveSharedLinkId] = useState<string | null>(null)
  const [sharedRunDocScope, setSharedRunDocScope] = useState<SharedRunDocScope | null>(null)
  const [pendingLlmProvidersOpen, setPendingLlmProvidersOpen] = useState(false)
  const [focusTestDocName, setFocusTestDocName] = useState<string | null>(null)

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

  const openLogging = useCallback((focus?: string | LoggingFocus) => {
    if (typeof focus === "string" || focus === undefined) {
      setFocusRunId(focus ?? null)
      setFocusRunAnchor(null)
    } else {
      setFocusRunId(focus.runId ?? null)
      setFocusRunAnchor(focus.anchor ?? null)
    }
    setActiveWindow("logging")
  }, [])

  const clearFocusRun = useCallback(() => {
    setFocusRunId(null)
    setFocusRunAnchor(null)
  }, [])

  const openStructure = useCallback((structureId?: StructureModelId) => {
    setFocusStructureId(structureId ?? null)
    setActiveWindow("structure")
  }, [])

  const clearFocusStructure = useCallback(() => setFocusStructureId(null), [])

  const clearPendingLlmProvidersOpen = useCallback(() => setPendingLlmProvidersOpen(false), [])

  const openTesting = useCallback((testDocName?: string) => {
    setFocusTestDocName(testDocName ?? null)
    setActiveWindow("testing")
  }, [])

  const clearFocusTestDoc = useCallback(() => setFocusTestDocName(null), [])

  const openSettingsSection = useCallback((sectionId: string) => {
    setActiveWindow("settings")
    if (sectionId === "settings-llm-providers") {
      setPendingLlmProvidersOpen(true)
      window.setTimeout(() => openLlmProvidersSettings(), 50)
      return
    }
    window.setTimeout(() => scrollToSettingsSection(sectionId), 50)
  }, [])

  const setActiveArea = useCallback((area: AppArea, consumer = false) => {
    const areas = consumer ? CONSUMER_AREAS : BUILDER_AREAS
    setActiveWindow(defaultWindowForArea(area, areas))
  }, [])

  return (
    <AppShellContext.Provider
      value={{
        activeWindow,
        setActiveWindow,
        setActiveArea,
        focusDocId,
        openDocuments,
        clearFocusDoc,
        focusRunId,
        focusRunAnchor,
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
        focusTestDocName,
        openTesting,
        clearFocusTestDoc,
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
