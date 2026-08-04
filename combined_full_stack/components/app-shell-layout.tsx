"use client"

// AI : TODO (spec) — git-like branching, merge, and revision history for project collaboration (spec § history).
import dynamic from "next/dynamic"
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { AppChromeHeader } from "@/components/app-chrome-header"
import { AppWindowNav } from "@/components/app-window-nav"
import { ProjectSelector } from "@/components/project-selector"
import { isAccountWindow } from "@/lib/app-nav-config"
import { handlePrimarySectionChange, resolvePrimarySection } from "@/lib/app-primary-section"
import {
  PrimarySectionOpeningProvider,
  usePrimarySectionOpening,
  wrapPrimarySectionChange,
} from "@/lib/primary-section-opening"
import { navigateToBuildMode, navigateToRunMode } from "@/lib/app-mode-nav"
import { useAppShellKind } from "@/lib/app-shell-kind"
import { ProjectPickerContext, useConsumerStore, useOptionalConsumerStore, useOptionalStore, useStore } from "@/lib/store"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"
import { useAppShell, type AppWindowId } from "@/lib/app-shell"
import { useSyncProjectDocStructures } from "@/lib/use-sync-project-doc-structures"
import { LazyDocViewer } from "@/components/lazy-doc-viewer"
import { SharedRunDocScopeProvider } from "@/lib/shared-run-doc-scope"
import { ProjectPickerPage } from "@/components/project-picker-page"
import { ProjectPickerSkeleton, StoreShellSkeleton } from "@/components/store-shell-skeletons"
import type { AppPrimarySection } from "@/components/app-primary-nav"
import { PanelLoading } from "@/components/panel-loading"
import {
  BillingPanelSkeleton,
  RunPanelSkeleton,
  SettingsPanelSkeleton,
} from "@/components/account-panel-skeletons"
import { Earnings } from "@/components/earnings"
import { FeedbackButton } from "@/components/feedback-button"
import { ProjectAssistantDockLayout } from "@/components/project-assistant-dock-layout"
import { ProjectAssistantDockToggle } from "@/components/project-assistant-dock"
import { DiagnosisAgentHub } from "@/components/diagnosis-agents/diagnosis-agent-hub"
import { RunningJobsHub } from "@/components/running-jobs-hub"
import { TooltipProvider } from "@/components/ui/tooltip"
import { isPreviewOnly } from "@/lib/demo-mode"
import { ActivityTracker } from "@/components/activity-tracker"
import { SessionReplayRecorder } from "@/components/session-replay-recorder"
import { SESSION_REPLAY_ENABLED } from "@/lib/session-replay-enabled"
import { prefetchShellPanels } from "@/lib/prefetch-shell-panels"
import { prefetchBillingPanel } from "@/lib/prefetch-billing-panel"
import { prefetchBuilderWorkspacePanels, prefetchWorkspacePanel } from "@/lib/prefetch-workspace-panel"
import { BackgroundPrefetchBar } from "@/components/background-prefetch-bar"
import { cn } from "@/lib/utils"

// AI : code-split heavy tabs — only Structure ships on first paint.
const StructureBuilder = dynamic(
  () => import("@/components/structure-builder").then((m) => ({ default: m.StructureBuilder })),
  { loading: () => <PanelLoading label="loading structure…" /> },
)
const PipelineBuilder = dynamic(
  () => import("@/components/pipeline-builder").then((m) => ({ default: m.PipelineBuilder })),
  { loading: () => <PanelLoading label="loading pipeline…" /> },
)
const Testing = dynamic(() => import("@/components/testing").then((m) => ({ default: m.Testing })), {
  loading: () => <PanelLoading label="loading testing…" />,
})
const Inference = dynamic(() => import("@/components/inference").then((m) => ({ default: m.Inference })), {
  loading: () => <PanelLoading label="loading inference…" /> },
)
const Share = dynamic(() => import("@/components/share/share-page").then((m) => ({ default: m.SharePage })), {
  loading: () => <RunPanelSkeleton /> },
)
const Logging = dynamic(() => import("@/components/logging").then((m) => ({ default: m.Logging })), {
  loading: () => <PanelLoading label="loading logging…" /> },
)
const Cache = dynamic(() => import("@/components/cache").then((m) => ({ default: m.Cache })), {
  loading: () => <PanelLoading label="loading cache…" /> },
)
const Documents = dynamic(() => import("@/components/documents").then((m) => ({ default: m.Documents })), {
  loading: () => <PanelLoading label="loading documents…" /> },
)
const Billing = dynamic(() => import("@/components/billing").then((m) => ({ default: m.Billing })), {
  loading: () => <BillingPanelSkeleton /> },
)
const SettingsPanel = dynamic(() => import("@/components/settings").then((m) => ({ default: m.Settings })), {
  loading: () => <SettingsPanelSkeleton /> },
)
const DocumentationPanel = dynamic(
  () => import("@/components/documentation").then((m) => ({ default: m.Documentation })),
  { loading: () => <PanelLoading label="loading docs…" /> },
)

function ProjectSwitchOverlay({ projectName }: { projectName: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-background/40 pt-16 backdrop-blur-[1px]">
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-sm">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        <p className="font-mono text-[11px] text-muted-foreground">switching to {projectName}…</p>
      </div>
    </div>
  )
}

const CONSUMER_WINDOW_IDS = new Set<AppWindowId>(["share", "billing", "settings"])

function resolveConsumerWindow(window: AppWindowId): AppWindowId {
  return CONSUMER_WINDOW_IDS.has(window) ? window : "share"
}

const CONSUMER_PANEL_IDS: AppWindowId[] = ["share", "billing", "settings"]

// AI : primary-nav account tabs stay mounted so Billing/Settings open instantly after prefetch.
const EAGER_ACCOUNT_PANEL_IDS: AppWindowId[] = ["billing", "settings"]

const BUILDER_PANEL_IDS: AppWindowId[] = [
  "structure",
  "pipeline",
  "testing",
  "inference",
  "share",
  "earnings",
  "logging",
  "cache",
  "documents",
  "docs",
  "billing",
  "settings",
]

function renderWindowPanel(windowId: AppWindowId): ReactNode {
  switch (windowId) {
    case "structure":
      return <StructureBuilder />
    case "pipeline":
      return <PipelineBuilder />
    case "testing":
      return <Testing />
    case "inference":
      return <Inference />
    case "share":
      return <Share />
    case "earnings":
      return <Earnings />
    case "logging":
      return <Logging />
    case "cache":
      return <Cache />
    case "documents":
      return <Documents />
    case "docs":
      return <DocumentationPanel />
    case "billing":
      return <Billing />
    case "settings":
      return <SettingsPanel />
    default:
      return null
  }
}

// AI : keep every visited panel mounted — switching tabs only toggles visibility.
function CachedShellWindowPanels({
  activeWindow,
  panelIds,
  eagerPanelIds = [],
}: {
  activeWindow: AppWindowId
  panelIds: AppWindowId[]
  eagerPanelIds?: AppWindowId[]
}) {
  const [mounted, setMounted] = useState<Set<AppWindowId>>(
    () => new Set([activeWindow, ...eagerPanelIds]),
  )

  useEffect(() => {
    setMounted((prev) => {
      if (prev.has(activeWindow)) return prev
      const next = new Set(prev)
      next.add(activeWindow)
      return next
    })
  }, [activeWindow])

  return (
    <>
      {panelIds
        .filter((windowId) => mounted.has(windowId))
        .map((windowId) => (
          <div
            key={windowId}
            className={cn(
              "flex h-full min-h-0 flex-1 flex-col",
              windowId !== activeWindow && "hidden",
            )}
            aria-hidden={windowId !== activeWindow}
          >
            {renderWindowPanel(windowId)}
          </div>
        ))}
    </>
  )
}

function WarmShellSlot({
  warm,
  ready,
  show,
  skeleton,
  children,
}: {
  warm: boolean
  ready: boolean
  show: boolean
  skeleton: ReactNode
  children: ReactNode
}) {
  if (warm && ready) {
    return (
      <div className={cn("h-dvh", !show && "hidden")} aria-hidden={!show}>
        {children}
      </div>
    )
  }
  if (show) return <>{skeleton}</>
  return null
}

function useSyncPrimarySectionReady(section: AppPrimarySection) {
  const { markSectionReady } = usePrimarySectionOpening()
  useLayoutEffect(() => {
    markSectionReady(section)
  }, [section, markSectionReady])
}

export function AppShellLayout({ variant = "default" }: { variant?: "default" | "embed" }) {
  return (
    <PrimarySectionOpeningProvider>
      <AppShellLayoutInner variant={variant} />
    </PrimarySectionOpeningProvider>
  )
}

function AppShellLayoutInner({ variant = "default" }: { variant?: "default" | "embed" }) {
  const { shellKind } = useAppShellKind()
  const builder = useOptionalStore()
  const consumer = useOptionalConsumerStore()
  const picker = useContext(ProjectPickerContext)

  const [warmShells, setWarmShells] = useState(() => ({
    consumer: shellKind === "consumer",
    builder: shellKind === "builder",
    picker: shellKind === "picker",
  }))

  useEffect(() => {
    setWarmShells((prev) => ({
      consumer: prev.consumer || shellKind === "consumer",
      builder: prev.builder || shellKind === "builder",
      picker: prev.picker || shellKind === "picker",
    }))
  }, [shellKind])

  useEffect(() => {
    prefetchShellPanels()
  }, [])

  const showConsumer = shellKind === "consumer"
  const showBuilder = shellKind === "builder"
  const showPicker = shellKind === "picker"

  return (
    <>
      <WarmShellSlot
        warm={warmShells.consumer}
        ready={!!consumer}
        show={showConsumer}
        skeleton={<StoreShellSkeleton />}
      >
        <ConsumerShellLayoutInner variant={variant} />
      </WarmShellSlot>

      <WarmShellSlot
        warm={warmShells.builder}
        ready={!!builder}
        show={showBuilder}
        skeleton={<StoreShellSkeleton />}
      >
        <BuilderShellLayoutInner variant={variant} />
      </WarmShellSlot>

      <WarmShellSlot
        warm={warmShells.picker}
        ready={!!picker}
        show={showPicker}
        skeleton={<ProjectPickerSkeleton />}
      >
        <ProjectPickerPage />
      </WarmShellSlot>
    </>
  )
}

function ConsumerShellLayoutInner({ variant = "default" }: { variant?: "default" | "embed" }) {
  const embed = variant === "embed"
  const { activeWindow, setActiveWindow } = useAppShell()
  const { stateSyncing } = useConsumerStore()
  const consumerWindow = useMemo(() => resolveConsumerWindow(activeWindow), [activeWindow])
  const primarySection = resolvePrimarySection("run", consumerWindow)
  const { openingSection, beginOpening } = usePrimarySectionOpening()
  useSyncPrimarySectionReady(primarySection)

  const onPrimarySectionChange = useCallback(
    (section: Parameters<typeof handlePrimarySectionChange>[0]) => {
      wrapPrimarySectionChange(section, primarySection, beginOpening, () => {
        handlePrimarySectionChange(
          section,
          "run",
          consumerWindow,
          setActiveWindow,
          navigateToRunMode,
          navigateToBuildMode,
        )
      })
    },
    [beginOpening, consumerWindow, primarySection, setActiveWindow],
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has("teamInvite")) setActiveWindow("settings")
    else if (params.has("session_id") || params.has("canceled") || params.get("window") === "billing")
      setActiveWindow("billing")
    else if (params.get("window") === "settings") setActiveWindow("settings")
    else if (!CONSUMER_WINDOW_IDS.has(activeWindow)) setActiveWindow("share")
  }, [activeWindow, setActiveWindow])

  useEffect(() => {
    prefetchBillingPanel()
  }, [])

  return (
    <TooltipProvider delay={200}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <AppChromeHeader
          mode="run"
          primarySection={primarySection}
          openingSection={openingSection}
          onPrimarySectionChange={onPrimarySectionChange}
          embed={embed}
          trailing={!embed ? <FeedbackButton /> : null}
        />

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden" id="main-content">
          {stateSyncing ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-background/40 pt-16 backdrop-blur-[1px]">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col">
            <CachedShellWindowPanels
              activeWindow={consumerWindow}
              panelIds={CONSUMER_PANEL_IDS}
              eagerPanelIds={EAGER_ACCOUNT_PANEL_IDS}
            />
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}

function BuilderShellLayoutInner({ variant = "default" }: { variant?: "default" | "embed" }) {
  const embed = variant === "embed"
  const { activeWindow, setActiveWindow, activeSharedLinkId, sharedRunDocScope } =
    useAppShell()
  const sharedRunDocScopeForViewer = useMemo(
    () => sharedRunDocScope ?? (activeSharedLinkId ? { linkId: activeSharedLinkId } : null),
    [sharedRunDocScope, activeSharedLinkId],
  )
  const { modules, models, project, projectLoading, typeAliases } = useStore()
  useSyncProjectDocStructures()
  const validity = useMemo(
    () => computeWorkspaceValidity(modules, models, typeAliases, !!project?.teamReadOnly),
    [modules, models, typeAliases, project?.teamReadOnly],
  )
  const primarySection = resolvePrimarySection("build", activeWindow)
  const showWorkspaceNav = !isAccountWindow(activeWindow)
  const { openingSection, beginOpening } = usePrimarySectionOpening()
  useSyncPrimarySectionReady(primarySection)

  const onPrimarySectionChange = useCallback(
    (section: Parameters<typeof handlePrimarySectionChange>[0]) => {
      wrapPrimarySectionChange(section, primarySection, beginOpening, () => {
        handlePrimarySectionChange(
          section,
          "build",
          activeWindow,
          setActiveWindow,
          navigateToRunMode,
          navigateToBuildMode,
        )
      })
    },
    [activeWindow, beginOpening, primarySection, setActiveWindow],
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has("teamInvite")) setActiveWindow("settings")
    else if (params.has("session_id") || params.has("canceled")) setActiveWindow("billing")
  }, [setActiveWindow])

  const warmedAllPanelsRef = useRef(false)

  useEffect(() => {
    prefetchBillingPanel()
  }, [])

  useEffect(() => {
    prefetchWorkspacePanel(activeWindow)
    if (!warmedAllPanelsRef.current) {
      warmedAllPanelsRef.current = true
      prefetchBuilderWorkspacePanels(activeWindow)
    }
  }, [activeWindow])

  const previewOnly = isPreviewOnly()

  return (
    <TooltipProvider delay={200}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        {previewOnly ? (
          <p className="border-b border-border bg-muted/30 px-4 py-1.5 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Preview — explore tabs freely · sign in to run pipelines
          </p>
        ) : null}
        <AppChromeHeader
          mode="build"
          primarySection={primarySection}
          openingSection={openingSection}
          onPrimarySectionChange={onPrimarySectionChange}
          embed={embed}
          projectSlot={<ProjectSelector embed={embed} />}
          trailing={
            !embed && (
              <>
                <RunningJobsHub />
                <ProjectAssistantDockToggle />
                <DiagnosisAgentHub />
                <FeedbackButton />
              </>
            )
          }
        />

        {showWorkspaceNav ? (
          <AppWindowNav
            activeWindow={activeWindow}
            onSelect={setActiveWindow}
            validity={validity}
          />
        ) : null}

        {embed ? (
          <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden" id="main-content">
            {projectLoading && <ProjectSwitchOverlay projectName={project.name} />}
            <div className="flex min-h-0 flex-1 flex-col">
              <CachedShellWindowPanels
                activeWindow={activeWindow}
                panelIds={BUILDER_PANEL_IDS}
                eagerPanelIds={EAGER_ACCOUNT_PANEL_IDS}
              />
            </div>
            <BackgroundPrefetchBar />
          </main>
        ) : (
          <ProjectAssistantDockLayout>
            <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden" id="main-content">
              {projectLoading && <ProjectSwitchOverlay projectName={project.name} />}
              <div className="flex min-h-0 flex-1 flex-col">
                <CachedShellWindowPanels
                activeWindow={activeWindow}
                panelIds={BUILDER_PANEL_IDS}
                eagerPanelIds={EAGER_ACCOUNT_PANEL_IDS}
              />
              </div>
              <BackgroundPrefetchBar />
            </main>
          </ProjectAssistantDockLayout>
        )}

        <SharedRunDocScopeProvider scope={sharedRunDocScopeForViewer}>
          <LazyDocViewer />
        </SharedRunDocScopeProvider>
        {!previewOnly ? (
          <>
            <ActivityTracker />
            {SESSION_REPLAY_ENABLED ? <SessionReplayRecorder /> : null}
          </>
        ) : null}
      </div>
    </TooltipProvider>
  )
}
