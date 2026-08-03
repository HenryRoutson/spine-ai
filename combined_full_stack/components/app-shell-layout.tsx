"use client"

// AI : TODO (spec) — git-like branching, merge, and revision history for project collaboration (spec § history).
import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, type ReactNode } from "react"
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
import { useConsumerStore, useOptionalConsumerStore, useOptionalStore, useStore } from "@/lib/store"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"
import { useAppShell, type AppWindowId } from "@/lib/app-shell"
import { useSyncProjectDocStructures } from "@/lib/use-sync-project-doc-structures"
import { LazyDocViewer } from "@/components/lazy-doc-viewer"
import { SharedRunDocScopeProvider } from "@/lib/shared-run-doc-scope"
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

function ShellWindowContent({
  activeWindow,
  mode = "builder",
}: {
  activeWindow: AppWindowId
  mode?: "builder" | "consumer"
}) {
  const windowId = mode === "consumer" ? resolveConsumerWindow(activeWindow) : activeWindow

  let content: ReactNode
  switch (windowId) {
    case "structure":
      content = <StructureBuilder />
      break
    case "pipeline":
      content = <PipelineBuilder />
      break
    case "testing":
      content = <Testing />
      break
    case "inference":
      content = <Inference />
      break
    case "share":
      content = <Share />
      break
    case "earnings":
      content = <Earnings />
      break
    case "logging":
      content = <Logging />
      break
    case "cache":
      content = <Cache />
      break
    case "documents":
      content = <Documents />
      break
    case "docs":
      content = <DocumentationPanel />
      break
    case "billing":
      content = <Billing />
      break
    case "settings":
      content = <SettingsPanel />
      break
    default:
      content = null
  }

  return <div className="flex h-full min-h-0 flex-1 flex-col">{content}</div>
}

export function AppShellLayout({ variant = "default" }: { variant?: "default" | "embed" }) {
  const builder = useOptionalStore()
  const consumer = useOptionalConsumerStore()
  if (!builder && consumer) return <ConsumerShellLayout variant={variant} />
  if (builder) return <BuilderShellLayout variant={variant} />
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}

function ConsumerShellLayout({ variant = "default" }: { variant?: "default" | "embed" }) {
  return (
    <PrimarySectionOpeningProvider>
      <ConsumerShellLayoutInner variant={variant} />
    </PrimarySectionOpeningProvider>
  )
}

function ConsumerShellLayoutInner({ variant = "default" }: { variant?: "default" | "embed" }) {
  const embed = variant === "embed"
  const { activeWindow, setActiveWindow } = useAppShell()
  const { stateSyncing } = useConsumerStore()
  const consumerWindow = useMemo(() => resolveConsumerWindow(activeWindow), [activeWindow])
  const primarySection = resolvePrimarySection("run", consumerWindow)
  const { openingSection, beginOpening } = usePrimarySectionOpening()

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
            <ShellWindowContent activeWindow={consumerWindow} mode="consumer" />
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}

function BuilderShellLayout({ variant = "default" }: { variant?: "default" | "embed" }) {
  return (
    <PrimarySectionOpeningProvider>
      <BuilderShellLayoutInner variant={variant} />
    </PrimarySectionOpeningProvider>
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
              <ShellWindowContent activeWindow={activeWindow} mode="builder" />
            </div>
          </main>
        ) : (
          <ProjectAssistantDockLayout>
            <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden" id="main-content">
              {projectLoading && <ProjectSwitchOverlay projectName={project.name} />}
              <div className="flex min-h-0 flex-1 flex-col">
                <ShellWindowContent activeWindow={activeWindow} mode="builder" />
              </div>
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
