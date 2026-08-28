"use client"

// AI : shell navigation — lets Inference/Logging jump to Documents and focus a stored hash.

import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from "react"
import {
  BUILDER_AREAS,
  CONSUMER_AREAS,
  defaultWindowForArea,
  guiDefaultWorkspaceWindow,
  isBuildStep,
  isAccountWindow,
  windowToArea,
  type AppArea,
  type VibeObserveTab,
} from "@/lib/app-nav-config"
import { openLlmProvidersSettings, scrollToSettingsSection } from "@/lib/settings-nav"
import type { SharedRunDocScope } from "@/lib/shared-run-doc-scope"
import type { SharedLinkRecord } from "@/lib/shared-link-types"
import type { DocId, ModuleId, StructureModelId } from "@/lib/types"
import { AppWindowId as AppWindow } from "@/lib/app-window-id"
import { readHideDeveloperTools } from "@/lib/developer-tools-settings"
import { writeBuildSurfacePreference } from "@/lib/build-surface-persist"
import { BuildSurface } from "@/lib/build-surface"
import {
  clearEditingWebsiteSession,
  readEditingWebsiteSession,
  writeEditingWebsiteSession,
} from "@/lib/editing-website-session"

export * from "@/lib/app-window-id"

type WindowId = (typeof AppWindow)[keyof typeof AppWindow]

export type LoggingFocusAnchor = "validation-errors"

export type LoggingFocus = {
  runId?: string
  anchor?: LoggingFocusAnchor
}

export type { AppArea } from "@/lib/app-nav-config"
export { windowToArea, isBuildStep } from "@/lib/app-nav-config"

export type website_workspace_surface = "page" | "code" | "backend"

interface AppShellState {
  activeWindow: WindowId
  setActiveWindow: (window: WindowId) => void
  setActiveArea: (area: AppArea, consumer?: boolean) => void
  focusDocId: DocId | null
  openDocuments: (docId?: DocId) => void
  clearFocusDoc: () => void
  focusRunId: string | null
  focusRunAnchor: LoggingFocusAnchor | null
  openLogging: (focus?: string | LoggingFocus) => void
  clearFocusRun: () => void
  // AI : Vibe right-pane tab — stay on Vibe when opening logs / inference.
  vibeObserveTab: VibeObserveTab
  setVibeObserveTab: (tab: VibeObserveTab) => void
  focusStructureId: StructureModelId | null
  openStructure: (structureId?: StructureModelId) => void
  clearFocusStructure: () => void
  focusModuleId: ModuleId | null
  openPipeline: (moduleId?: ModuleId) => void
  clearFocusModule: () => void
  activeSharedLinkId: string | null
  openSharedRun: (linkId: string) => void
  clearSharedRun: () => void
  sharedRunDocScope: SharedRunDocScope | null
  setSharedRunDocScope: (scope: SharedRunDocScope | null) => void
  openSettingsSection: (sectionId: string) => void
  openSecrets: () => void
  pendingLlmProvidersOpen: boolean
  clearPendingLlmProvidersOpen: () => void
  focusTestDocName: string | null
  openTesting: (testDocName?: string) => void
  clearFocusTestDoc: () => void
  editingWebsite: SharedLinkRecord | null
  openWebsiteEditor: (link: SharedLinkRecord) => void
  clearWebsiteEditor: () => void
  patchEditingWebsite: (link: SharedLinkRecord) => void
  // AI : website workspace sub-page — page studio, frontend code, or backend peek. Never pipeline DAG tabs.
  websiteSurface: website_workspace_surface
  setWebsiteSurface: (surface: website_workspace_surface) => void
}

const AppShellContext = createContext<AppShellState | null>(null)

export function AppShellProvider({ children }: { children: ReactNode }) {
  // AI : Simplified lands on Inference; full lands on Structure. GUI never opens the Vibe window.
  const [activeWindow, setActiveWindowState] = useState<WindowId>(() => {
    return guiDefaultWorkspaceWindow(readHideDeveloperTools(), false)
  })
  const setActiveWindow = useCallback((window: WindowId) => {
    // AI : GUI has no Data tab — Backend is TUI/deep-link only; Structures owns SQL + rows.
    const next = window === AppWindow.Backend ? AppWindow.Structure : window
    setActiveWindowState(next)
    if (!isAccountWindow(next) && next !== AppWindow.Vibe) writeBuildSurfacePreference(BuildSurface.Editors)
  }, [])
  const [focusDocId, setFocusDocId] = useState<DocId | null>(null)
  const [focusRunId, setFocusRunId] = useState<string | null>(null)
  const [focusRunAnchor, setFocusRunAnchor] = useState<LoggingFocusAnchor | null>(null)
  const [vibeObserveTab, setVibeObserveTab] = useState<VibeObserveTab>(AppWindow.Inference)
  const [focusStructureId, setFocusStructureId] = useState<StructureModelId | null>(null)
  const [focusModuleId, setFocusModuleId] = useState<ModuleId | null>(null)
  const [activeSharedLinkId, setActiveSharedLinkId] = useState<string | null>(null)
  const [sharedRunDocScope, setSharedRunDocScope] = useState<SharedRunDocScope | null>(null)
  const [pendingLlmProvidersOpen, setPendingLlmProvidersOpen] = useState(false)
  const [focusTestDocName, setFocusTestDocName] = useState<string | null>(null)
  const [editingWebsite, setEditingWebsite] = useState<SharedLinkRecord | null>(null)
  const [websiteSurface, setWebsiteSurface] = useState<website_workspace_surface>("page")

  useLayoutEffect(() => {
    const saved = readEditingWebsiteSession()
    if (!saved) return
    setEditingWebsite(saved)
    setWebsiteSurface("page")
    setVibeObserveTab(AppWindow.Share)
    setActiveWindow(AppWindow.Share)
  }, [])

  const openSharedRun = useCallback((linkId: string) => {
    setActiveSharedLinkId(linkId)
    setActiveWindow(AppWindow.Share)
  }, [])

  const clearSharedRun = useCallback(() => setActiveSharedLinkId(null), [])

  const openDocuments = useCallback((docId?: DocId) => {
    setFocusDocId(docId ?? null)
    setActiveWindow(AppWindow.Documents)
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
    if (readHideDeveloperTools()) {
      setActiveWindow(AppWindow.Inference)
      return
    }
    if (activeWindow === AppWindow.Vibe) {
      setVibeObserveTab(AppWindow.Logging)
      return
    }
    setActiveWindow(AppWindow.Logging)
  }, [activeWindow])

  const clearFocusRun = useCallback(() => {
    setFocusRunId(null)
    setFocusRunAnchor(null)
  }, [])

  const openStructure = useCallback((structureId?: StructureModelId) => {
    setFocusStructureId(structureId ?? null)
    setActiveWindow(AppWindow.Structure)
  }, [])

  const clearFocusStructure = useCallback(() => setFocusStructureId(null), [])

  const openPipeline = useCallback((moduleId?: ModuleId) => {
    setFocusModuleId(moduleId ?? null)
    setActiveWindow(AppWindow.Pipeline)
  }, [])

  const clearFocusModule = useCallback(() => setFocusModuleId(null), [])

  const clearPendingLlmProvidersOpen = useCallback(() => setPendingLlmProvidersOpen(false), [])

  const openTesting = useCallback((testDocName?: string) => {
    setFocusTestDocName(testDocName ?? null)
    setActiveWindow(readHideDeveloperTools() ? AppWindow.Pipeline : AppWindow.Testing)
  }, [])

  const clearFocusTestDoc = useCallback(() => setFocusTestDocName(null), [])

  const openWebsiteEditor = useCallback((link: SharedLinkRecord) => {
    writeEditingWebsiteSession(link)
    setEditingWebsite(link)
    setWebsiteSurface("page")
    setVibeObserveTab(AppWindow.Share)
    setActiveWindow(AppWindow.Share)
  }, [])

  const clearWebsiteEditor = useCallback(() => {
    clearEditingWebsiteSession()
    setEditingWebsite(null)
    setWebsiteSurface("page")
  }, [])

  const patchEditingWebsite = useCallback((link: SharedLinkRecord) => {
    writeEditingWebsiteSession(link)
    setEditingWebsite(link)
  }, [])

  const openSecrets = useCallback(() => {
    setActiveWindow(AppWindow.Secrets)
  }, [])

  const openSettingsSection = useCallback((sectionId: string) => {
    // AI : legacy deep-link — secrets moved to Library → Secrets tab.
    if (sectionId === "settings-secrets" || sectionId === "settings-secrets") {
      setActiveWindow(AppWindow.Secrets)
      return
    }
    setActiveWindow(AppWindow.Settings)
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
        vibeObserveTab,
        setVibeObserveTab,
        focusStructureId,
        openStructure,
        clearFocusStructure,
        focusModuleId,
        openPipeline,
        clearFocusModule,
        activeSharedLinkId,
        openSharedRun,
        clearSharedRun,
        sharedRunDocScope,
        setSharedRunDocScope,
        openSettingsSection,
        openSecrets,
        pendingLlmProvidersOpen,
        clearPendingLlmProvidersOpen,
        focusTestDocName,
        openTesting,
        clearFocusTestDoc,
        editingWebsite,
        openWebsiteEditor,
        clearWebsiteEditor,
        patchEditingWebsite,
        websiteSurface,
        setWebsiteSurface,
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
