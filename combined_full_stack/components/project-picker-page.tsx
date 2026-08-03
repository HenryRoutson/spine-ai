"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Copy,
  FolderKanban,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Store,
} from "lucide-react"
import { useStorePicker } from "@/lib/store"
import { clearActiveProjectSession } from "@/lib/active-project-session"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/time-ago"
import { AnimatedRemovalItem } from "@/components/animated-removal-item"
import { DeleteButton } from "@/components/delete-button"
import { useAnimatedRemoval } from "@/lib/use-animated-removal"
import {
  BlankProjectButton,
  ExampleTemplateGrid,
} from "@/components/project-workspace-sections"
import { MarketplaceBrowsePanel } from "@/components/share/marketplace-browse-panel"
import { SpineLogoBox } from "@/components/spine-mark"
import { LEGAL } from "@shared/legal/site"
import type { Project, ProjectId } from "@/lib/types"

const LANDING_PAGE_URL = "https://www.spine-ai.dev/"

export function ProjectPickerPage() {
  const router = useRouter()
  const {
    projects,
    addProject,
    renameProject,
    deleteProject,
    cloneFromTemplate,
    cloneProject,
    resyncExamples,
    openProject,
    syncing,
  } = useStorePicker()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [resyncMsg, setResyncMsg] = useState<string | null>(null)
  const { isDeleting, isExiting, runDelete, mergeWithGhosts } = useAnimatedRemoval<Project>()
  const displayProjects = mergeWithGhosts(projects)

  const handleOpen = useCallback((id: ProjectId) => openProject(id), [openProject])

  async function handleCreateBlank() {
    setBusy("blank")
    try {
      await addProject()
    } finally {
      setBusy(null)
    }
  }

  async function handleCloneTemplate(templateId: ProjectId) {
    setBusy(templateId)
    try {
      await cloneFromTemplate(templateId)
    } finally {
      setBusy(null)
    }
  }

  async function handleCloneProject(id: string) {
    setBusy(`clone-${id}`)
    try {
      await cloneProject(id)
    } finally {
      setBusy(null)
    }
  }

  async function handleResync() {
    setBusy("resync")
    setResyncMsg(null)
    try {
      const updated = await resyncExamples()
      setResyncMsg(updated ? `Refreshed bundled example documents.` : "Example documents already up to date.")
    } catch (e) {
      setResyncMsg((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  function startEdit(p: Project) {
    setEditingId(p.id)
    setEditName(p.name)
  }

  function commitEdit(id: string) {
    renameProject(id, editName)
    setEditingId(null)
  }

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
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
        <span className="font-mono text-[11px] text-muted-foreground">build pipelines</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-8 gap-1.5 font-mono text-[11px]"
          onClick={() => {
            clearActiveProjectSession()
            router.push("/")
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to run
        </Button>
        {syncing && (
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            syncing
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <WindowHeader
          step="Build"
          title="Your pipelines"
          description="Create and edit automation pipelines. To run someone else's shared link without building, go back to Run."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-transparent"
                onClick={() => void handleResync()}
                disabled={busy === "resync"}
              >
                {busy === "resync" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Refresh docs
              </Button>
              <BlankProjectButton
                busy={busy === "blank"}
                onClick={() => void handleCreateBlank()}
              />
            </div>
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <section className="mb-8 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Just want to run a shared pipeline?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No project needed — paste a shared link, top up in Billing, and run.
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  clearActiveProjectSession()
                  router.push("/")
                }}
              >
                <Play className="h-3.5 w-3.5" />
                Run shared links
              </Button>
            </div>
          </section>

          {resyncMsg && (
            <p className="mb-4 rounded-md border border-border bg-secondary/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
              {resyncMsg}
            </p>
          )}

          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Your projects</h3>
              <span className="font-mono text-[10px] text-muted-foreground">({projects.length})</span>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {displayProjects.map((p) => {
                const deleting = isDeleting(p.id)
                const exiting = isExiting(p.id)
                return (
                  <AnimatedRemovalItem
                    key={p.id}
                    itemId={p.id}
                    isExiting={exiting}
                    className={cn("flex flex-wrap items-center gap-3 px-4 py-3", deleting && "opacity-60")}
                  >
                    <div className="min-w-0 flex-1">
                      {editingId === p.id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit(p.id)
                            if (e.key === "Escape") setEditingId(null)
                          }}
                          onBlur={() => commitEdit(p.id)}
                          autoFocus
                          className="h-8 max-w-xs text-sm"
                        />
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{p.name}</span>
                          </div>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {p.kind} · {p.modules.length} steps · {p.modules.filter((m) => m.kind === "input").length}{" "}
                            input
                            {p.modules.some((m) => m.inputNameContains) ? " · name rules" : ""}
                            {p.createdAt != null ? (
                              <>
                                {" · "}
                                {new Date(p.createdAt).toLocaleDateString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                                {" ("}
                                {timeAgo(p.createdAt)}
                                {")"}
                              </>
                            ) : null}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Button variant="default" size="sm" className="h-8" onClick={() => handleOpen(p.id)}>
                        Open
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => startEdit(p)} aria-label={`Rename ${p.name}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleCloneProject(p.id)}
                        disabled={busy === `clone-${p.id}`}
                        aria-label={`Clone ${p.name}`}
                      >
                        {busy === `clone-${p.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <DeleteButton
                        variant="ghost"
                        size="icon-sm"
                        deleting={deleting}
                        label={`Delete ${p.name}`}
                        onClick={() => void runDelete(p, projects, () => deleteProject(p.id))}
                      />
                    </div>
                  </AnimatedRemovalItem>
                )
              })}
            </ul>
          </section>

          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Marketplace</h3>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Search pipelines others published — copy one into your workspace to edit independently.
              Publish your own from Share → Marketplace.
            </p>
            <MarketplaceBrowsePanel embedded />
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Copy className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Example templates</h3>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Example templates are read-only until you clone them into your workspace.
            </p>
            <ExampleTemplateGrid
              busyId={busy}
              onClone={(id) => void handleCloneTemplate(id)}
              cloneLabel="Clone & open"
            />
          </section>
        </div>
      </div>
    </div>
  )
}
