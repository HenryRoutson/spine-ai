"use client"

import { useCallback, useState } from "react"
import {
  ArrowLeft,
  Copy,
  FolderKanban,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react"
import { useStorePicker } from "@/lib/store"
import { WindowHeader } from "@/components/window-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/time-ago"
import { AnimatedRemovalItem } from "@/components/animated-removal-item"
import { DeleteButton } from "@/components/delete-button"
import { useAnimatedRemoval } from "@/lib/use-animated-removal"
import { useProjectTemplates } from "@/lib/use-project-templates"
import { SpineLogoBox } from "@/components/spine-mark"
import { LEGAL } from "@shared/legal/site"
import type { Project, ProjectId } from "@/lib/types"

const LANDING_PAGE_URL = "https://withspine.dev/"

export function ProjectPickerPage() {
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
  const { templates, loading: loadingTemplates } = useProjectTemplates()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [resyncMsg, setResyncMsg] = useState<string | null>(null)
  const { isDeleting, isExiting, runDelete, mergeWithGhosts } = useAnimatedRemoval<Project>()
  const displayProjects = mergeWithGhosts(projects)

  const handleOpen = useCallback((id: ProjectId) => openProject(id), [openProject])

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
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground")}
        >
          <ArrowLeft className="h-4 w-4" />
        </a>
        <div className="flex items-center gap-2.5">
          <SpineLogoBox />
          <div className="hidden leading-tight sm:block">
            <h1 className="text-sm font-semibold tracking-tight">{LEGAL.productName}</h1>
          </div>
        </div>
        <div className="mx-1 h-6 w-px bg-border" />
        <span className="font-mono text-[11px] text-muted-foreground">select a project</span>
        {syncing && (
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            syncing
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <WindowHeader
          step="Projects"
          title="Your pipelines"
          description="Choose a project to open, or create one from a blank pipeline or example template."
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
              <Button size="sm" onClick={addProject} disabled={busy === "blank"}>
                {busy === "blank" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                )}
                Blank project
              </Button>
            </div>
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
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

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Copy className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Example templates</h3>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Example templates are read-only until you clone them into your workspace.
            </p>
            {loadingTemplates ? (
              <p className="font-mono text-[11px] text-muted-foreground">Loading templates…</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {templates.map((t) => (
                  <li key={t.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{t.kind}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 font-mono text-[9px]">
                        {t.moduleCount} steps
                      </Badge>
                    </div>
                    <p className="mb-3 font-mono text-[10px] text-muted-foreground">
                      {t.inputCount} input slot{t.inputCount === 1 ? "" : "s"}
                    </p>
                    <Button size="sm" onClick={() => void handleCloneTemplate(t.id)} disabled={busy === t.id}>
                      {busy === t.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Clone &amp; open
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
