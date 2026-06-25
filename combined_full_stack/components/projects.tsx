"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Check,
  Copy,
  FolderKanban,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { useAppShell } from "@/lib/app-shell"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { apiJson } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import type { Project, ProjectId } from "@/lib/types"

type ProjectTemplateSummary = {
  id: ProjectId
  name: string
  kind: string
  moduleCount: number
  inputCount: number
}

function isBuiltInExample(project: Project, templateIds: Set<string>): boolean {
  return templateIds.has(project.id)
}

export function Projects() {
  const {
    projects,
    project,
    setActiveProjectId,
    addProject,
    renameProject,
    deleteProject,
    cloneFromTemplate,
    cloneProject,
    resyncExamples,
  } = useStore()
  const { setActiveWindow } = useAppShell()
  const [templates, setTemplates] = useState<ProjectTemplateSummary[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [resyncMsg, setResyncMsg] = useState<string | null>(null)

  const templateIds = new Set(templates.map((t) => t.id))

  useEffect(() => {
    let cancelled = false
    void apiJson<{ templates: ProjectTemplateSummary[] }>(API_ROUTES.projectTemplates)
      .then((data) => {
        if (!cancelled) setTemplates(data.templates)
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const openProject = useCallback(
    (id: string) => {
      setActiveProjectId(id)
      setActiveWindow("pipeline")
    },
    [setActiveProjectId, setActiveWindow],
  )

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
      setResyncMsg(updated ? `Updated ${updated} built-in example(s) from repo seeds.` : "Built-in examples already up to date.")
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
    <div className="flex h-full flex-col">
      <WindowHeader
        step="Projects"
        title="Your pipelines"
        description="Switch projects, clone numbered copies from examples, or refresh templates from seeds."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => void handleResync()} disabled={busy === "resync"}>
              {busy === "resync" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Refresh examples
            </Button>
            <Button size="sm" onClick={addProject}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Blank project
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
          <p className="mb-3 text-xs text-muted-foreground">
            The header dropdown is a quick switcher — this page is the full manager.
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {projects.map((p) => {
              const active = p.id === project.id
              const builtIn = isBuiltInExample(p, templateIds)
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 px-4 py-3",
                    active && "bg-primary/5",
                  )}
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
                          {active && (
                            <Badge className="h-4 bg-primary/15 px-1.5 font-mono text-[9px] text-primary hover:bg-primary/15">
                              active
                            </Badge>
                          )}
                          {builtIn && (
                            <Badge variant="outline" className="h-4 font-mono text-[9px] text-muted-foreground">
                              built-in example
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {p.kind} · {p.modules.length} steps · {p.modules.filter((m) => m.kind === "input").length} input
                          {p.modules.some((m) => m.inputNameContains) ? " · name rules" : ""}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 bg-transparent" onClick={() => openProject(p.id)}>
                      {active ? <Check className="mr-1.5 h-3.5 w-3.5" /> : null}
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
                      {busy === `clone-${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    {projects.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteProject(p.id)}
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
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
            Clone creates a numbered copy you can open and edit — e.g.{" "}
            <span className="font-mono">Company Legal Evaluation 1</span>, then{" "}
            <span className="font-mono">Company Legal Evaluation 2</span>.
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
                    {busy === t.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                    Clone
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
