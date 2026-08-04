"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Copy,
  FolderKanban,
  Loader2,
  Pencil,
  RefreshCw,
  Store,
} from "lucide-react"
import { useStorePicker } from "@/lib/store"
import { AppChromeHeader } from "@/components/app-chrome-header"
import { AppMode, navigateToBuildMode, navigateToRunMode } from "@/lib/app-mode-nav"
import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import { handlePrimarySectionChange } from "@/lib/app-primary-section"
import { useAppShell } from "@/lib/app-shell"
import {
  usePrimarySectionOpening,
  wrapPrimarySectionChange,
} from "@/lib/primary-section-opening"
import { PROJECT_PICKER_PANEL_HEADER } from "@/lib/window-panel-meta"
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
import { warmProjectPrefetches } from "@/lib/project-state-cache"
import type { Project, ProjectId } from "@/lib/types"

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
    prefetchProject,
    syncing,
  } = useStorePicker()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<ProjectId | null>(null)
  const [resyncMsg, setResyncMsg] = useState<string | null>(null)
  const { openingSection, beginOpening, markSectionReady } = usePrimarySectionOpening()
  const { activeWindow, setActiveWindow } = useAppShell()
  const { isDeleting, isExiting, runDelete, mergeWithGhosts } = useAnimatedRemoval<Project>()
  const displayProjects = mergeWithGhosts(projects)

  useEffect(() => {
    warmProjectPrefetches(
      projects.map((p) => p.id),
      prefetchProject,
    )
  }, [projects, prefetchProject])

  const handleOpen = useCallback(
    (id: ProjectId) => {
      setOpeningId(id)
      openProject(id)
    },
    [openProject],
  )

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
      <AppChromeHeader
        mode={AppMode.Build}
        primarySection={AppPrimarySection.Build}
        openingSection={openingSection}
        onPrimarySectionChange={(section) => {
          wrapPrimarySectionChange(section, AppPrimarySection.Build, beginOpening, () => {
            if (section === AppPrimarySection.Build) {
              navigateToBuildMode()
              markSectionReady(AppPrimarySection.Build)
              return
            }
            if (section === AppPrimarySection.Run) {
              navigateToRunMode()
              return
            }
            navigateToRunMode()
            handlePrimarySectionChange(
              section,
              AppMode.Run,
              activeWindow,
              setActiveWindow,
              navigateToRunMode,
              navigateToBuildMode,
            )
          })
        }}
        trailing={
          syncing ? (
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              syncing
            </span>
          ) : null
        }
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <WindowHeader
          {...PROJECT_PICKER_PANEL_HEADER}
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
              {displayProjects.length === 0 ? (
                <li className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No projects yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a blank project or clone an example template below.
                  </p>
                </li>
              ) : null}
              {displayProjects.map((p) => {
                const deleting = isDeleting(p.id)
                const exiting = isExiting(p.id)
                return (
                  <AnimatedRemovalItem
                    key={p.id}
                    itemId={p.id}
                    isExiting={exiting}
                    className={cn("flex flex-wrap items-center gap-3 px-4 py-3", deleting && "opacity-60")}
                    onMouseEnter={() => prefetchProject(p.id)}
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
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8"
                        onClick={() => void handleOpen(p.id)}
                        disabled={openingId !== null || busy !== null}
                      >
                        {openingId === p.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : null}
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
