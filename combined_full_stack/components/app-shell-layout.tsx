"use client"

// AI : TODO (spec) — git-like branching, merge, and revision history for project collaboration (spec § history).
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Boxes,
  Play,
  ScrollText,
  Database,
  Files,
  CreditCard,
  Settings,
  Plus,
  Check,
  Pencil,
  Loader2,
  LayoutGrid,
  ChevronDown,
  BookOpen,
  SquareCheck,
  Share2,
  SquareArrowUp,
  Users,
  Wallet,
} from "lucide-react"
import { ResizableSplit } from "@/components/resizable-split"
import { navSplit, NAV_ICON_ONLY_MAX_WIDTH } from "@/lib/layout-split-settings"
import { usePersistedLeadingWidth } from "@/lib/use-persisted-leading-width"
import { cn } from "@/lib/utils"
import { useConsumerStore, useOptionalConsumerStore, useOptionalStore, useStore } from "@/lib/store"
import {
  computeWorkspaceValidity,
  workspaceNavTabButtonClass,
  workspaceNavTabDisabled,
  workspaceNavTabIconClass,
  workspaceNavTabIssue,
  workspaceNavTabTitle,
} from "@/lib/workspace-validity-ui"
import { createClient } from "@/utils/supabase/client"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AnimatedRemovalItem } from "@/components/animated-removal-item"
import { DeleteButton } from "@/components/delete-button"
import { useAnimatedRemoval } from "@/lib/use-animated-removal"
import { SpineLogoBox, SpineNavIcon } from "@/components/spine-mark"
import { clearActiveProjectSession } from "@/lib/active-project-session"
import { LEGAL } from "@shared/legal/site"
import { isPreviewOnly } from "@/lib/demo-mode"
import { ActivityTracker } from "@/components/activity-tracker"
import { SessionReplayRecorder } from "@/components/session-replay-recorder"
import { SESSION_REPLAY_ENABLED } from "@/lib/session-replay-enabled"
import type { Project } from "@/lib/types"

// AI : marketing site lives on a separate deploy from the app
const LANDING_PAGE_URL = "https://www.spine-ai.dev/"

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

type WindowId = AppWindowId

type NavIcon = React.ComponentType<{ className?: string }>

const WINDOWS: { id: WindowId; label: string; hint: string; icon: NavIcon }[] = [
  { id: "structure", label: "Structures", hint: "01", icon: Boxes },
  { id: "pipeline", label: "Pipeline", hint: "02", icon: SpineNavIcon },
  // AI : Testing sits before Inference — tests run before demoing (spec § Testing).
  { id: "testing", label: "Testing", hint: "03", icon: SquareCheck },
  { id: "inference", label: "Inference", hint: "04", icon: Play },
  { id: "share", label: "Share", hint: "05", icon: SquareArrowUp },
  { id: "earnings", label: "Earnings", hint: "06", icon: Wallet },
  { id: "logging", label: "Logging", hint: "07", icon: ScrollText },
  { id: "cache", label: "Cache", hint: "08", icon: Database },
  { id: "documents", label: "Documents", hint: "09", icon: Files },
  { id: "docs", label: "Docs", hint: "10", icon: BookOpen },
  { id: "billing", label: "Billing", hint: "11", icon: CreditCard },
]

const CONSUMER_WINDOWS: { id: WindowId; label: string; hint: string; icon: NavIcon }[] = [
  { id: "share", label: "Shared with me", hint: "01", icon: Users },
  { id: "billing", label: "Billing", hint: "02", icon: CreditCard },
]

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

function ProjectRenameInput({
  initialName,
  onCommit,
  onCancel,
}: {
  initialName: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const valueRef = useRef(initialName)
  const skipBlurCommit = useRef(false)

  return (
    <div
      className="px-1.5 py-1"
      // AI : menu items steal focus / typeahead on pointer + keyboard — block both.
      onPointerDown={(e) => e.preventDefault()}
      onKeyDownCapture={(e) => e.stopPropagation()}
      onKeyUpCapture={(e) => e.stopPropagation()}
    >
      <Input
        defaultValue={initialName}
        onChange={(e) => {
          valueRef.current = e.target.value
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            skipBlurCommit.current = true
            onCommit(valueRef.current)
          }
          if (e.key === "Escape") {
            skipBlurCommit.current = true
            onCancel()
          }
        }}
        onBlur={() => {
          if (skipBlurCommit.current) {
            skipBlurCommit.current = false
            return
          }
          onCommit(valueRef.current)
        }}
        onClick={(e) => e.stopPropagation()}
        autoFocus
        className="h-7 text-xs"
      />
    </div>
  )
}

function ProjectSelector({ embed = false }: { embed?: boolean }) {
  const router = useRouter()
  const { projects, project, setActiveProjectId, prefetchProject, addProject, renameProject, deleteProject } =
    useStore()
  const [editing, setEditing] = useState<{ id: string; initialName: string } | null>(null)
  const { isDeleting, isExiting, runDelete, mergeWithGhosts } = useAnimatedRemoval<Project>()
  const displayProjects = mergeWithGhosts(projects)

  function startRename(id: string, name: string) {
    setEditing({ id, initialName: name })
  }

  function commitRename(id: string, name: string) {
    renameProject(id, name)
    setEditing(null)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs transition-colors hover:bg-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="max-w-[180px] truncate font-medium">{project.name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground">
            projects
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
        {displayProjects.map((p) =>
          editing?.id === p.id ? (
            <ProjectRenameInput
              key={p.id}
              initialName={editing.initialName}
              onCommit={(name) => commitRename(p.id, name)}
              onCancel={() => setEditing(null)}
            />
          ) : (
          <AnimatedRemovalItem
            key={p.id}
            itemId={p.id}
            isExiting={isExiting(p.id)}
            as="div"
            className={cn(isDeleting(p.id) && "opacity-60")}
          >
          <DropdownMenuItem
            onMouseEnter={() => prefetchProject(p.id)}
            onFocus={() => prefetchProject(p.id)}
            onClick={() => setActiveProjectId(p.id)}
            className="group flex items-center justify-between gap-2 text-xs"
          >
            <>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{p.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {p.kind}
                  {p.createdAt != null ? ` · ${new Date(p.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {!embed && (
                  <>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    startRename(p.id, p.name)
                  }}
                  aria-label={`Rename ${p.name}`}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <DeleteButton
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  deleting={isDeleting(p.id)}
                  label={`Delete ${p.name}`}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    e.preventDefault()
                    void runDelete(p, projects, () => deleteProject(p.id))
                  }}
                />
                  </>
                )}
                {p.id === project.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
            </>
          </DropdownMenuItem>
          </AnimatedRemovalItem>
          ),
        )}
        </DropdownMenuGroup>
        {!embed && (
          <>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
        <DropdownMenuItem
          onClick={() => {
            clearActiveProjectSession()
            router.push("/")
          }}
          className="gap-2 py-2.5 font-medium"
        >
          <Share2 className="h-4 w-4" />
          Run shared links…
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            clearActiveProjectSession()
            router.push("/projects")
          }}
          className="gap-2 py-2.5 font-medium"
        >
          <LayoutGrid className="h-4 w-4" />
          All projects…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={addProject} className="gap-2 py-2.5 font-medium text-primary">
          <Plus className="h-4 w-4" />
          New project
        </DropdownMenuItem>
        </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
  const router = useRouter()
  const { activeWindow, setActiveWindow } = useAppShell()
  const { stateSyncing } = useConsumerStore()
  const consumerTabs = useMemo(() => new Set<WindowId>(["share", "billing", "settings"]), [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has("teamInvite")) setActiveWindow("settings")
    else if (params.has("session_id") || params.has("canceled")) setActiveWindow("billing")
    else if (!consumerTabs.has(activeWindow)) setActiveWindow("share")
  }, [activeWindow, consumerTabs, setActiveWindow])

  const { width: navWidth, setWidth: setNavWidth, commitWidth: commitNavWidth } =
    usePersistedLeadingWidth(navSplit)
  const showNavLabels = navWidth > NAV_ICON_ONLY_MAX_WIDTH

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
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
          <HeaderSettingsButton
            active={activeWindow === "settings"}
            onClick={() => setActiveWindow("settings")}
          />
          {!embed ? <FeedbackButton /> : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ResizableSplit
          className="min-h-0 flex-1"
          leadingWidth={navWidth}
          onLeadingWidthChange={setNavWidth}
          onLeadingWidthCommit={commitNavWidth}
          minLeading={navSplit.min}
          maxLeading={navSplit.max}
          leading={
            <nav
              className={cn(
                "flex h-full flex-col gap-1 overflow-x-hidden overflow-y-auto py-3",
                showNavLabels ? "items-stretch px-2" : "items-center px-0.5",
              )}
            >
              {CONSUMER_WINDOWS.map((w) => {
                const Icon = w.icon
                const isActive = activeWindow === w.id
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setActiveWindow(w.id)}
                    title={w.label}
                    className={cn(
                      "group flex items-center rounded-md text-sm transition-colors",
                      showNavLabels
                        ? "min-h-0 justify-start gap-3 px-2.5 py-2"
                        : "h-10 w-10 shrink-0 justify-center p-0",
                      workspaceNavTabButtonClass(isActive, null, false),
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", workspaceNavTabIconClass(isActive, null))} />
                    {showNavLabels ? (
                      <>
                        <span className="min-w-0 flex-1 break-words text-left">{w.label}</span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{w.hint}</span>
                      </>
                    ) : null}
                  </button>
                )
              })}
              <div className="mt-auto border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/projects")}
                  title="Build your own pipelines"
                  className={cn(
                    "group flex w-full items-center rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    showNavLabels ? "gap-3 px-2.5 py-2" : "h-10 justify-center p-0",
                  )}
                >
                  <LayoutGrid className="h-4 w-4 shrink-0" />
                  {showNavLabels ? <span className="text-left">Build pipelines…</span> : null}
                </button>
              </div>
            </nav>
          }
          trailing={
            <main className="relative min-w-0 flex-1 overflow-hidden" id="main-content">
              {stateSyncing ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-background/40 pt-16 backdrop-blur-[1px]">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : null}
              {activeWindow === "share" && <Share />}
              {activeWindow === "billing" && <Billing />}
              {activeWindow === "settings" && <SettingsPanel />}
            </main>
          }
        />
      </div>
    </div>
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

  const { width: navWidth, setWidth: setNavWidth, commitWidth: commitNavWidth } =
    usePersistedLeadingWidth(navSplit)
  const showNavLabels = navWidth > NAV_ICON_ONLY_MAX_WIDTH
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
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {previewOnly ? (
        <p className="border-b border-border bg-muted/30 px-4 py-1.5 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Preview — explore tabs freely · sign in to run pipelines
        </p>
      ) : null}
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ResizableSplit
          className="min-h-0 flex-1"
          leadingWidth={navWidth}
          onLeadingWidthChange={setNavWidth}
          onLeadingWidthCommit={commitNavWidth}
          minLeading={navSplit.min}
          maxLeading={navSplit.max}
          leading={
            <nav
              className={cn(
                "flex h-full flex-col gap-1 overflow-x-hidden overflow-y-auto py-3",
                showNavLabels ? "items-stretch px-2" : "items-center px-0.5",
              )}
            >
              {WINDOWS.map((w) => {
                const Icon = w.icon
                const isActive = activeWindow === w.id
                const issue = workspaceNavTabIssue(w.id, validity)
                const disabled = workspaceNavTabDisabled(w.id, validity)
                return (
                  <button
                    key={w.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return
                      setActiveWindow(w.id)
                    }}
                    title={workspaceNavTabTitle(w.id, w.label, validity)}
                    className={cn(
                      "group flex items-center rounded-md text-sm transition-colors",
                      showNavLabels
                        ? "min-h-0 justify-start gap-3 px-2.5 py-2"
                        : "h-10 w-10 shrink-0 justify-center p-0",
                      workspaceNavTabButtonClass(isActive, issue, disabled),
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        workspaceNavTabIconClass(isActive, issue),
                      )}
                    />
                    {showNavLabels ? (
                      <>
                        <span className="min-w-0 flex-1 break-words text-left">{w.label}</span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{w.hint}</span>
                      </>
                    ) : null}
                  </button>
                )
              })}
            </nav>
          }
          trailing={builderMain}
        />
      </div>

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
  )
}
