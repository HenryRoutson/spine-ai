"use client"

// AI : TODO (spec) — git-like branching, merge, and revision history for project collaboration (spec § history).
// AI : TODO (opt-browser-tui-shell) — optional: when surface=tui, hide AppWindowNav + GUI panels and
// AI :   mount a DOM WorkspaceView; keep this header so the toggle stays reachable. Not Ink-in-browser.
import dynamic from "next/dynamic"
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { AppChromeHeader } from "@/components/app-chrome-header"
import { AppWindowNav } from "@/components/app-window-nav"
import { ProjectSelector } from "@/components/project-selector"
import { BUILDER_NAV_ITEMS, BUILDER_PANEL_IDS, isAccountWindow, isVibeWindow } from "@/lib/app-nav-config"
import { handlePrimarySectionChange, resolvePrimarySection } from "@/lib/app-primary-section"
import { BuildSurfaceNav } from "@/components/build-surface-nav"
import { resolveBuildSurface, windowForBuildSurface, type BuildSurface } from "@/lib/build-surface"
import {
  PrimarySectionOpeningProvider,
  usePrimarySectionOpening,
  wrapPrimarySectionChange,
} from "@/lib/primary-section-opening"
import { AppMode, navigateToBuildMode, navigateToRunMode } from "@/lib/app-mode-nav"
import { CONSUMER_NAV_ITEMS } from "@/lib/app-nav-config"
import { AppShellKind, useAppShellKind } from "@/lib/app-shell-kind"
import { readActiveProjectSession } from "@/lib/active-project-session"
import { ProjectPickerContext, useConsumerStore, useOptionalConsumerStore, useOptionalStore, useStore } from "@/lib/store"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"
import { useAppShell } from "@/lib/app-shell"
import { AppWindowId } from "@/lib/app-window-id"
import { useSyncProjectDocStructures } from "@/lib/use-sync-project-doc-structures"
import { LazyDocViewer } from "@/components/lazy-doc-viewer"
import { SharedRunDocScopeProvider } from "@/lib/shared-run-doc-scope"
import { ProjectPickerPage } from "@/components/project-picker-page"
import { ProjectPickerSkeleton, StoreShellSkeleton } from "@/components/store-shell-skeletons"
import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import { useHideDeveloperTools } from "@/lib/developer-tools-settings"
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
import { uiContextTargetProps } from "@/lib/ui-context-dom"
import { RunningJobsHub } from "@/components/running-jobs-hub"
import { RunJobsProvider } from "@/lib/run-jobs-context"
import { TooltipProvider } from "@/components/ui/tooltip"
import { isDemoMode, isPreviewOnly } from "@/lib/demo-mode"
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
const ProjectBilling = dynamic(
  () => import("@/components/project-billing").then((m) => ({ default: m.ProjectBilling })),
  { loading: () => <BillingPanelSkeleton variant="project" /> },
)
const ProjectSettings = dynamic(
  () => import("@/components/project-settings").then((m) => ({ default: m.ProjectSettings })),
  { loading: () => <PanelLoading label="loading project settings…" /> },
)
const SettingsPanel = dynamic(() => import("@/components/settings").then((m) => ({ default: m.Settings })), {
  loading: () => <SettingsPanelSkeleton /> },
)
const DocumentationPanel = dynamic(
  () => import("@/components/documentation").then((m) => ({ default: m.Documentation })),
  { loading: () => <PanelLoading label="loading docs…" /> },
)
const VibePanel = dynamic(() => import("@/components/vibe-panel").then((m) => ({ default: m.VibePanel })), {
  loading: () => <PanelLoading label="loading vibe…" /> },
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

const CONSUMER_WINDOW_IDS = new Set<AppWindowId>([AppWindowId.Share, AppWindowId.Billing, AppWindowId.Settings])

function resolveConsumerWindow(window: AppWindowId): AppWindowId {
  return CONSUMER_WINDOW_IDS.has(window) ? window : AppWindowId.Share
}

const CONSUMER_PANEL_IDS: AppWindowId[] = [AppWindowId.Share, AppWindowId.Billing, AppWindowId.Settings]

// AI : primary-nav account tabs stay mounted so Billing/Settings open instantly after prefetch.
const EAGER_ACCOUNT_PANEL_IDS: AppWindowId[] = [AppWindowId.Billing, AppWindowId.Settings]

function renderWindowPanel(windowId: AppWindowId): ReactNode {
  switch (windowId) {
    case AppWindowId.Structure:
      return <StructureBuilder />
    case AppWindowId.Pipeline:
      return <PipelineBuilder />
    case AppWindowId.Testing:
      return <Testing />
    case AppWindowId.Inference:
      return <Inference />
    case AppWindowId.Share:
      return <Share />
    case AppWindowId.Earnings:
      return <Earnings />
    case AppWindowId.Logging:
      return <Logging />
    case AppWindowId.Cache:
      return <Cache />
    case AppWindowId.Documents:
      return <Documents />
    case AppWindowId.Docs:
      return <DocumentationPanel />
    case AppWindowId.ProjectBilling:
      return <ProjectBilling />
    case AppWindowId.ProjectSettings:
      return <ProjectSettings />
    case AppWindowId.Vibe:
      return <VibePanel />
    case AppWindowId.Billing:
      return <Billing />
    case AppWindowId.Settings:
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
        .map((windowId) => {
          const label =
            BUILDER_NAV_ITEMS.find((item) => item.id === windowId)?.label ??
            (windowId === AppWindowId.Billing
              ? "Billing"
              : windowId === AppWindowId.Settings
                ? "Settings"
                : String(windowId))
          return (
          <div
            key={windowId}
            className={cn(
              "flex h-full min-h-0 flex-1 flex-col",
              windowId !== activeWindow && "hidden",
            )}
            aria-hidden={windowId !== activeWindow}
            {...uiContextTargetProps({
              kind: "generic",
              id: `window-panel:${windowId}`,
              label: `Panel · ${label}`,
              snippet: `Workspace panel: ${label}`,
            })}
          >
            {renderWindowPanel(windowId)}
          </div>
          )
        })}
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
  if (ready && (warm || show)) {
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
  // AI : provider lives here so / and /demo (landing live preview) both get a jobs registry.
  return (
    <RunJobsProvider>
      <PrimarySectionOpeningProvider>
        <AppShellLayoutInner variant={variant} />
      </PrimarySectionOpeningProvider>
    </RunJobsProvider>
  )
}

function AppShellLayoutInner({ variant = "default" }: { variant?: "default" | "embed" }) {
  const { shellKind, navigateToProjectPicker } = useAppShellKind()
  const builder = useOptionalStore()
  const consumer = useOptionalConsumerStore()
  const picker = useContext(ProjectPickerContext)

  const [warmShells, setWarmShells] = useState(() => ({
    consumer: !isDemoMode() && shellKind === AppShellKind.Consumer,
    builder: shellKind === AppShellKind.Builder,
    picker: shellKind === AppShellKind.Picker,
  }))

  useEffect(() => {
    setWarmShells((prev) => ({
      consumer: prev.consumer || shellKind === AppShellKind.Consumer,
      builder: prev.builder || shellKind === AppShellKind.Builder,
      picker: prev.picker || shellKind === AppShellKind.Picker,
    }))
  }, [shellKind])

  useEffect(() => {
    prefetchShellPanels()
  }, [])

  // AI : builder shell with no active project (failed/missing load) — recover instead of infinite skeleton.
  useEffect(() => {
    if (shellKind !== AppShellKind.Builder) return
    if (builder) return
    // AI : create/open writes session before the store context exists — wait, don't bounce to picker.
    if (readActiveProjectSession()) return
    if (!consumer && !picker) return
    navigateToProjectPicker()
  }, [shellKind, builder, consumer, picker, navigateToProjectPicker])

  const showConsumer = shellKind === AppShellKind.Consumer
  const showBuilder = shellKind === AppShellKind.Builder
  const showPicker = shellKind === AppShellKind.Picker

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
  const showWorkspaceNav =
    !isAccountWindow(consumerWindow) && CONSUMER_NAV_ITEMS.length > 1
  const primarySection = resolvePrimarySection(AppMode.Run, consumerWindow)
  const { openingSection, beginOpening } = usePrimarySectionOpening()
  useSyncPrimarySectionReady(primarySection)

  const onPrimarySectionChange = useCallback(
    (section: Parameters<typeof handlePrimarySectionChange>[0]) => {
      wrapPrimarySectionChange(section, primarySection, beginOpening, () => {
        handlePrimarySectionChange(
          section,
          AppMode.Run,
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
    if (params.has("teamInvite")) setActiveWindow(AppWindowId.Settings)
    else if (params.has("session_id") || params.has("canceled") || params.get("window") === AppWindowId.Billing)
      setActiveWindow(AppWindowId.Billing)
    else if (params.get("window") === AppWindowId.Settings) setActiveWindow(AppWindowId.Settings)
    else if (!CONSUMER_WINDOW_IDS.has(activeWindow)) setActiveWindow(AppWindowId.Share)
  }, [activeWindow, setActiveWindow])

  useEffect(() => {
    prefetchBillingPanel()
  }, [])

  return (
    <TooltipProvider delay={200}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <AppChromeHeader
          mode={AppMode.Run}
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
          {showWorkspaceNav ? (
            <AppWindowNav
              activeWindow={consumerWindow}
              onSelect={setActiveWindow}
              items={CONSUMER_NAV_ITEMS}
            />
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col">
            <CachedShellWindowPanels
              activeWindow={consumerWindow}
              panelIds={CONSUMER_PANEL_IDS}
              eagerPanelIds={embed ? [] : EAGER_ACCOUNT_PANEL_IDS}
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
  const hideDeveloperTools = useHideDeveloperTools()
  const primarySection = resolvePrimarySection(AppMode.Build, activeWindow)
  const isVibe = isVibeWindow(activeWindow)
  const isAccount = isAccountWindow(activeWindow)
  const buildSurface = resolveBuildSurface(activeWindow)
  // AI : surface toggle shares Build chrome; workspace tabs only on editors surface.
  const showSurfaceToggle = !embed && !hideDeveloperTools && !isAccount
  const showWorkspaceTabs = !isAccount && !isVibe
  const showWorkspaceChrome = showSurfaceToggle || showWorkspaceTabs
  const { openingSection, beginOpening } = usePrimarySectionOpening()
  useSyncPrimarySectionReady(primarySection)

  const onPrimarySectionChange = useCallback(
    (section: Parameters<typeof handlePrimarySectionChange>[0]) => {
      wrapPrimarySectionChange(section, primarySection, beginOpening, () => {
        handlePrimarySectionChange(
          section,
          AppMode.Build,
          activeWindow,
          setActiveWindow,
          navigateToRunMode,
          navigateToBuildMode,
        )
      })
    },
    [activeWindow, beginOpening, primarySection, setActiveWindow],
  )

  const onBuildSurfaceChange = useCallback(
    (surface: BuildSurface) => {
      setActiveWindow(windowForBuildSurface(surface))
    },
    [setActiveWindow],
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has("teamInvite")) setActiveWindow(AppWindowId.Settings)
    else if (params.has("session_id") || params.has("canceled")) setActiveWindow(AppWindowId.Billing)
  }, [setActiveWindow])

  // AI : hide developer tools → force Vibe surface inside Build (L0 Build stays).
  useEffect(() => {
    if (!hideDeveloperTools) return
    if (primarySection !== AppPrimarySection.Build) return
    if (isVibe) return
    setActiveWindow(AppWindowId.Vibe)
  }, [hideDeveloperTools, isVibe, primarySection, setActiveWindow])

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
          mode={AppMode.Build}
          primarySection={primarySection}
          openingSection={openingSection}
          onPrimarySectionChange={onPrimarySectionChange}
          embed={embed}
          projectSlot={<ProjectSelector embed={embed} />}
          trailing={
            !embed && (
              <>
                <RunningJobsHub />
                <DiagnosisAgentHub />
                <FeedbackButton />
              </>
            )
          }
        />

        {showWorkspaceChrome ? (
          <AppWindowNav
            activeWindow={activeWindow}
            onSelect={setActiveWindow}
            validity={validity}
            leading={
              showSurfaceToggle ? (
                <BuildSurfaceNav value={buildSurface} onChange={onBuildSurfaceChange} />
              ) : null
            }
            showItems={showWorkspaceTabs}
            trailing={!embed && showWorkspaceTabs ? <ProjectAssistantDockToggle /> : null}
          />
        ) : null}

        {/* AI : TODO (vibe) — when leaving Vibe, optionally re-open Build dock if it was open before. */}
        {embed || isVibe ? (
          <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden" id="main-content">
            {projectLoading && <ProjectSwitchOverlay projectName={project.name} />}
            <div className="flex min-h-0 flex-1 flex-col">
              <CachedShellWindowPanels
                activeWindow={activeWindow}
                panelIds={BUILDER_PANEL_IDS}
                eagerPanelIds={embed ? [] : EAGER_ACCOUNT_PANEL_IDS}
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
                eagerPanelIds={embed ? [] : EAGER_ACCOUNT_PANEL_IDS}
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
