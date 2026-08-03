"use client"

// AI : TODO (spec) — git-like branching, merge, and revision history for project collaboration (spec § history).
import dynamic from "next/dynamic"
import { useEffect, useMemo } from "react"
import { Loader2, Settings } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { ProjectSelector } from "@/components/project-selector"
import { BUILDER_NAV_ITEMS, CONSUMER_NAV_ITEMS, LANDING_PAGE_URL } from "@/lib/app-nav-config"
import { cn } from "@/lib/utils"
import { useConsumerStore, useOptionalConsumerStore, useOptionalStore, useStore } from "@/lib/store"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"
import { useAppShell, type AppWindowId } from "@/lib/app-shell"
import { useSyncProjectDocStructures } from "@/lib/use-sync-project-doc-structures"
import { LazyDocViewer } from "@/components/lazy-doc-viewer"
import { SharedRunDocScopeProvider } from "@/lib/shared-run-doc-scope"
import { PanelLoading } from "@/components/panel-loading"
import { Earnings } from "@/components/earnings"
import { FeedbackButton } from "@/components/feedback-button"
import { ProjectAssistantDockLayout } from "@/components/project-assistant-dock-layout"
import { ProjectAssistantDockToggle } from "@/components/project-assistant-dock"
import { DiagnosisAgentHub } from "@/components/diagnosis-agents/diagnosis-agent-hub"
import { RunningJobsHub } from "@/components/running-jobs-hub"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SpineLogoBox } from "@/components/spine-mark"
import { LEGAL } from "@shared/legal/site"
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
  loading: () => <PanelLoading label="loading inference…" />,
})
const Share = dynamic(() => import("@/components/share/share-page").then((m) => ({ default: m.SharePage })), {
  loading: () => <PanelLoading label="loading share…" />,
})
const Logging = dynamic(() => import("@/components/logging").then((m) => ({ default: m.Logging })), {
  loading: () => <PanelLoading label="loading logging…" />,
})
const Cache = dynamic(() => import("@/components/cache").then((m) => ({ default: m.Cache })), {
  loading: () => <PanelLoading label="loading cache…" />,
})
const Documents = dynamic(() => import("@/components/documents").then((m) => ({ default: m.Documents })), {
  loading: () => <PanelLoading label="loading documents…" />,
})
const Billing = dynamic(() => import("@/components/billing").then((m) => ({ default: m.Billing })), {
  loading: () => <PanelLoading label="loading billing…" />,
})
const SettingsPanel = dynamic(() => import("@/components/settings").then((m) => ({ default: m.Settings })), {
  loading: () => <PanelLoading label="loading settings…" />,
})
const DocumentationPanel = dynamic(
  () => import("@/components/documentation").then((m) => ({ default: m.Documentation })),
  { loading: () => <PanelLoading label="loading docs…" /> },
)

function HeaderSettingsButton({
  active,
  onClick,
}: {
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Settings"
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
        active ? "bg-secondary text-foreground" : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Settings className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Settings</span>
    </button>
  )
}

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
  const embed = variant === "embed"
  const { activeWindow, setActiveWindow } = useAppShell()
  const { stateSyncing } = useConsumerStore()
  const consumerTabs = useMemo(() => new Set<AppWindowId>(["share", "billing", "settings"]), [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has("teamInvite")) setActiveWindow("settings")
    else if (params.has("session_id") || params.has("canceled")) setActiveWindow("billing")
    else if (!consumerTabs.has(activeWindow)) setActiveWindow("share")
  }, [activeWindow, consumerTabs, setActiveWindow])

  return (
    <TooltipProvider delay={200}>
      <SidebarProvider className="min-h-svh">
        <AppSidebar
          items={CONSUMER_NAV_ITEMS}
          activeWindow={activeWindow}
          onSelect={setActiveWindow}
          groupLabel="Shared runs"
          consumerFooter
        />
        <SidebarInset className="flex min-h-svh flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <a
                href={LANDING_PAGE_URL}
                title="Back to landing page"
                className="flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-80"
              >
                <SpineLogoBox />
                <div className="hidden leading-tight sm:block">
                  <h1 className="text-sm font-semibold tracking-tight">{LEGAL.productName}</h1>
                </div>
              </a>
              <div className="mx-1 h-6 w-px bg-border" />
              <span className="font-mono text-[11px] text-muted-foreground">run shared pipelines</span>
            </div>
            <div className="flex items-center gap-2">
              <SidebarTrigger className="hidden md:flex" />
              <HeaderSettingsButton
                active={activeWindow === "settings"}
                onClick={() => setActiveWindow("settings")}
              />
              {!embed ? <FeedbackButton /> : null}
            </div>
          </header>

          <main className="relative min-h-0 flex-1 overflow-hidden" id="main-content">
            {stateSyncing ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-background/40 pt-16 backdrop-blur-[1px]">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : null}
            {activeWindow === "share" && <Share />}
            {activeWindow === "billing" && <Billing />}
            {activeWindow === "settings" && <SettingsPanel />}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function BuilderShellLayout({ variant = "default" }: { variant?: "default" | "embed" }) {
  const embed = variant === "embed"
  const { activeWindow, setActiveWindow, activeSharedLinkId, sharedRunDocScope } = useAppShell()
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has("teamInvite")) setActiveWindow("settings")
    else if (params.has("session_id") || params.has("canceled")) setActiveWindow("billing")
  }, [setActiveWindow])

  const previewOnly = isPreviewOnly()

  const builderMain = (
    <ProjectAssistantDockLayout>
      <main className="relative min-w-0 flex-1 overflow-hidden" id="main-content">
      {projectLoading && <ProjectSwitchOverlay projectName={project.name} />}
      {activeWindow === "structure" && <StructureBuilder />}
      {activeWindow === "pipeline" && <PipelineBuilder />}
      {activeWindow === "testing" && <Testing />}
      {activeWindow === "inference" && <Inference />}
      {activeWindow === "share" && <Share />}
      {activeWindow === "earnings" && <Earnings />}
      {activeWindow === "logging" && <Logging />}
      {activeWindow === "cache" && <Cache />}
      {activeWindow === "documents" && <Documents />}
      {activeWindow === "docs" && <DocumentationPanel />}
      {activeWindow === "billing" && <Billing />}
      {activeWindow === "settings" && <SettingsPanel />}
      </main>
    </ProjectAssistantDockLayout>
  )

  return (
    <TooltipProvider delay={200}>
      <SidebarProvider className="min-h-svh">
        <AppSidebar
          items={BUILDER_NAV_ITEMS}
          activeWindow={activeWindow}
          onSelect={setActiveWindow}
          validity={validity}
        />
        <SidebarInset className="flex min-h-svh flex-col overflow-hidden">
          {previewOnly ? (
            <p className="border-b border-border bg-muted/30 px-4 py-1.5 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Preview — explore tabs freely · sign in to run pipelines
            </p>
          ) : null}
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              {embed ? (
                <div className="flex items-center gap-2.5 rounded-md">
                  <SpineLogoBox />
                  <div className="hidden leading-tight sm:block">
                    <h1 className="text-sm font-semibold tracking-tight">{LEGAL.productName}</h1>
                  </div>
                </div>
              ) : (
                <a
                  href={LANDING_PAGE_URL}
                  title="Back to landing page"
                  className="flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-80"
                >
                  <SpineLogoBox />
                  <div className="hidden leading-tight sm:block">
                    <h1 className="text-sm font-semibold tracking-tight">{LEGAL.productName}</h1>
                  </div>
                </a>
              )}
              <div className="mx-1 h-6 w-px bg-border" />
              <ProjectSelector embed={embed} />
            </div>
            <div className="flex items-center gap-2">
              <SidebarTrigger className="hidden md:flex" />
              <HeaderSettingsButton
                active={activeWindow === "settings"}
                onClick={() => setActiveWindow("settings")}
              />
              {!embed && (
                <>
                  <RunningJobsHub />
                  <ProjectAssistantDockToggle />
                  <DiagnosisAgentHub />
                  <FeedbackButton />
                </>
              )}
            </div>
          </header>

          <div className="flex min-h-0 flex-1 overflow-hidden">{builderMain}</div>

          <SharedRunDocScopeProvider scope={sharedRunDocScopeForViewer}>
            <LazyDocViewer />
          </SharedRunDocScopeProvider>
          {!previewOnly ? (
            <>
              <ActivityTracker />
              {SESSION_REPLAY_ENABLED ? <SessionReplayRecorder /> : null}
            </>
          ) : null}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
