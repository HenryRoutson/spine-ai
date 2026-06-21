"use client"

import { useEffect, useRef, useState } from "react"
import {
  Boxes,
  GitBranch,
  Play,
  ScrollText,
  Files,
  CreditCard,
  Settings,
  Plus,
  Check,
  LogOut,
  UserRound,
  Pencil,
  Trash2,
  ArrowLeft,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { StoreProvider, useStore } from "@/lib/store"
import { computeInvalid } from "@/lib/validity"
import { createClient } from "@/utils/supabase/client"
import { DocViewerProvider } from "@/lib/doc-viewer"
import { AppShellProvider, useAppShell, type AppWindowId } from "@/lib/app-shell"
import { ModelSelector } from "@/components/model-selector"
import { DocViewer } from "@/components/doc-viewer"
import { StructureBuilder } from "@/components/structure-builder"
import { PipelineBuilder } from "@/components/pipeline-builder"
// import { AbTesting } from "@/components/ab-testing" // AI : commented out — placeholder until auto-config benchmark lands
import { Inference } from "@/components/inference"
import { Logging } from "@/components/logging"
import { Documents } from "@/components/documents"
import { Billing } from "@/components/billing"
import { Settings as SettingsPanel } from "@/components/settings"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button, buttonVariants } from "@/components/ui/button"

// AI : marketing site lives on a separate deploy from the app
const LANDING_PAGE_URL = "https://auto-pipeline.dev/"

type WindowId = AppWindowId

const WINDOWS: { id: WindowId; label: string; hint: string; icon: typeof Boxes }[] = [
  { id: "structure", label: "Structure", hint: "01", icon: Boxes },
  { id: "pipeline", label: "Pipeline", hint: "02", icon: GitBranch },
  { id: "inference", label: "Inference", hint: "03", icon: Play },
  { id: "logging", label: "Logging", hint: "04", icon: ScrollText },
  { id: "documents", label: "Documents", hint: "05", icon: Files },
  { id: "billing", label: "Billing", hint: "06", icon: CreditCard },
  { id: "settings", label: "Settings", hint: "07", icon: Settings },
]

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

function ProjectSelector() {
  const { projects, project, setActiveProjectId, prefetchProject, addProject, renameProject, deleteProject } =
    useStore()
  const [editing, setEditing] = useState<{ id: string; initialName: string } | null>(null)
  const canDelete = projects.length > 1

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
        {projects.map((p) =>
          editing?.id === p.id ? (
            <ProjectRenameInput
              key={p.id}
              initialName={editing.initialName}
              onCommit={(name) => commitRename(p.id, name)}
              onCancel={() => setEditing(null)}
            />
          ) : (
          <DropdownMenuItem
            key={p.id}
            onMouseEnter={() => prefetchProject(p.id)}
            onFocus={() => prefetchProject(p.id)}
            onClick={() => setActiveProjectId(p.id)}
            className="group flex items-center justify-between gap-2 text-xs"
          >
            <>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{p.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{p.kind}</span>
              </span>
              <div className="flex shrink-0 items-center gap-1">
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
                {canDelete && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive opacity-0 hover:text-destructive group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      deleteProject(p.id)
                    }}
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
                {p.id === project.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
            </>
          </DropdownMenuItem>
          ),
        )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
        <DropdownMenuItem onClick={addProject} className="gap-2 text-xs text-primary">
          <Plus className="h-3.5 w-3.5" />
          New project
        </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// AI : todo §7 — signed in ⇒ per-user Supabase data (email shown); anonymous ⇒ local store.
function AccountMenu() {
  const [email, setEmail] = useState<string | null>(null)
  useEffect(() => {
    void createClient()
      .then((supabase) => supabase.auth.getUser())
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => setEmail(null))
  }, [])

  if (!email)
    return (
      <span className="font-mono text-[11px] text-muted-foreground">…</span>
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 font-mono text-[11px] transition-colors hover:bg-accent">
        <UserRound className="h-3.5 w-3.5 text-primary" />
        <span className="max-w-[140px] truncate">{email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => {
            void createClient()
              .then((supabase) => supabase.auth.signOut())
              .then(() => (window.location.href = "/login"))
          }}
          className="gap-2 text-xs"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProjectSwitchLoading({ projectName }: { projectName: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="font-mono text-xs text-muted-foreground">loading {projectName}…</p>
    </div>
  )
}

function Shell() {
  const { activeWindow, setActiveWindow } = useAppShell()
  const { model, setModel, modules, project, projectLoading } = useStore()
  const pipelineInvalid = computeInvalid(modules).size > 0

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has("session_id") || params.has("canceled")) setActiveWindow("billing")
  }, [setActiveWindow])

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <a
            href={LANDING_PAGE_URL}
            title="Back to landing page"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "text-muted-foreground",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="font-mono text-sm font-bold">|</span>
            </div>
            <div className="hidden leading-tight sm:block">
              <h1 className="text-sm font-semibold tracking-tight">auto pipeline</h1>
            </div>
          </div>
          <div className="mx-1 h-6 w-px bg-border" />
          <ProjectSelector />
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] text-muted-foreground md:inline">
            default model
          </span>
          <ModelSelector value={model} onChange={setModel} />
          <AccountMenu />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="flex w-14 flex-col items-center gap-1 border-r border-border py-3 lg:w-44 lg:items-stretch lg:px-2">
          {WINDOWS.map((w) => {
            const Icon = w.icon
            const isActive = activeWindow === w.id
            const isInferenceInvalid = w.id === "inference" && pipelineInvalid
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setActiveWindow(w.id)}
                title={
                  isInferenceInvalid
                    ? "Fix pipeline errors before running inference"
                    : w.label
                }
                className={cn(
                  "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                  "justify-center lg:justify-start",
                  isInferenceInvalid
                    ? isActive
                      ? "bg-destructive/10 text-destructive"
                      : "text-destructive hover:bg-destructive/10 hover:text-destructive"
                    : isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isInferenceInvalid
                      ? "text-destructive"
                      : isActive
                        ? "text-primary"
                        : "text-muted-foreground",
                  )}
                />
                <span className="hidden flex-1 text-left lg:inline">{w.label}</span>
                <span className="hidden font-mono text-[10px] text-muted-foreground lg:inline">
                  {w.hint}
                </span>
              </button>
            )
          })}
          <div className="mt-auto hidden px-2.5 lg:block">
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              pipelines are linear. left to right.
            </p>
          </div>
        </nav>

        <main className="flex-1 overflow-hidden">
          {projectLoading ? (
            <ProjectSwitchLoading projectName={project.name} />
          ) : (
            <>
              {activeWindow === "structure" && <StructureBuilder />}
              {activeWindow === "pipeline" && <PipelineBuilder />}
              {activeWindow === "inference" && <Inference />}
              {activeWindow === "logging" && <Logging />}
              {activeWindow === "documents" && <Documents />}
              {activeWindow === "billing" && <Billing />}
              {activeWindow === "settings" && <SettingsPanel />}
            </>
          )}
        </main>
      </div>

      <DocViewer />
    </div>
  )
}

export default function Page() {
  return (
    <StoreProvider>
      <DocViewerProvider>
        <AppShellProvider>
          <Shell />
        </AppShellProvider>
      </DocViewerProvider>
    </StoreProvider>
  )
}
