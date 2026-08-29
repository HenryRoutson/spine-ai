"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Copy,
  FolderKanban,
  Globe,
  LayoutTemplate,
  Loader2,
  Pencil,
  RefreshCw,
  Store,
  Users,
} from "lucide-react"
import { useStorePicker } from "@/lib/store"
import { AppChromeHeader } from "@/components/app-chrome-header"
import { AppMode, navigateToBuildMode, navigateToRunMode } from "@/lib/app-mode-nav"
import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import { handlePrimarySectionChange } from "@/lib/app-primary-section"
import { useAppShell, AppWindowId } from "@/lib/app-shell"
import { useAppShellKind, AppShellKind } from "@/lib/app-shell-kind"
import {
  usePrimarySectionOpening,
  wrapPrimarySectionChange,
} from "@/lib/primary-section-opening"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/time-ago"
import { sortProjectsForList } from "@/lib/project-active"
import { AnimatedRemovalItem } from "@/components/animated-removal-item"
import { DeleteButton } from "@/components/delete-button"
import { useAnimatedRemoval } from "@/lib/use-animated-removal"
import {
  BlankProjectButton,
  ExampleTemplateGrid,
} from "@/components/project-workspace-sections"
import { MarketplaceBrowsePanel } from "@/components/share/marketplace-browse-panel"
import { SharedWithMePanel } from "@/components/share/shared-with-me-panel"
import { ShareTabLabel } from "@/lib/window-panel-meta"
import { warmProjectPrefetches } from "@/lib/project-state-cache"
import {
  PROJECT_DELETE_SETTINGS_CHANGED_EVENT,
  readQuickProjectDelete,
} from "@/lib/project-delete-settings"
import { useBrowserPrefEvent } from "@/lib/use-browser-pref-event"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { isSiteLinkId, normalizeHostedSiteOptions } from "@/lib/hosted-site"
import type { SharedLinkRecord } from "@/lib/shared-link-types"
import {
  hostedSiteOptionsForCreate,
  listedWebsitePipelineBindings,
  websiteDisplayName,
} from "@/lib/website-pipelines"
import { consumePendingPickerList, readPickerList, pickerHomeHref, type picker_list_tab } from "@/lib/picker-list"
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
  const { activeWindow, setActiveWindow, openSharedRun, openWebsiteEditor, clearWebsiteEditor } = useAppShell()
  const { shellKind } = useAppShellKind()
  const { isDeleting, isExiting, runDelete, mergeWithGhosts } = useAnimatedRemoval<Project>()
  const quickDelete = useBrowserPrefEvent(PROJECT_DELETE_SETTINGS_CHANGED_EVENT, readQuickProjectDelete)
  const pickerPrimarySection = AppPrimarySection.Build
  const sortedProjects = useMemo(() => sortProjectsForList(projects), [projects])
  const displayProjects = mergeWithGhosts(sortedProjects)
  const [listTab, setListTab] = useState<picker_list_tab>(readPickerList)

  useEffect(() => {
    if (shellKind !== AppShellKind.Picker) return
    setListTab(consumePendingPickerList() ?? readPickerList())
  }, [shellKind])

  const selectList = useCallback((tab: picker_list_tab) => {
    setListTab(tab)
    if (typeof window === "undefined") return
    window.history.replaceState(null, "", pickerHomeHref(tab))
  }, [])
  const [sites, setSites] = useState<SharedLinkRecord[]>([])
  const [sitesLoading, setSitesLoading] = useState(false)

  useEffect(() => {
    warmProjectPrefetches(
      projects.map((p) => p.id),
      prefetchProject,
    )
  }, [projects, prefetchProject])

  useEffect(() => {
    let cancelled = false
    setSitesLoading(true)
    void apiJson<{ links: SharedLinkRecord[] }>(API_ROUTES.sharedLinks)
      .then((body) => {
        if (cancelled) return
        setSites((body.links ?? []).filter((link) => isSiteLinkId(link.id) && !link.revoked))
      })
      .catch(() => {
        if (!cancelled) setSites([])
      })
      .finally(() => {
        if (!cancelled) setSitesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projects.length])

  const siteCountByProject = useMemo(() => {
    const counts = new Map<ProjectId, number>()
    for (const site of sites) {
      for (const id of listedWebsitePipelineBindings(site.siteOptions.pipelineBindings).map((b) => b.projectId)) {
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    }
    return counts
  }, [sites])

  const handleOpen = useCallback(
    (id: ProjectId) => {
      clearWebsiteEditor()
      setOpeningId(id)
      openProject(id)
    },
    [clearWebsiteEditor, openProject],
  )

  const handleOpenWebsite = useCallback(
    (link: SharedLinkRecord) => {
      openWebsiteEditor(link)
      setOpeningId(link.projectId)
      openProject(link.projectId)
    },
    [openProject, openWebsiteEditor],
  )

  const handleRunShared = useCallback(
    (linkId: string) => {
      openSharedRun(linkId)
      navigateToRunMode()
    },
    [openSharedRun],
  )

  async function handleCreateBlank() {
    setBusy("blank")
    try {
      await addProject({ open: false })
    } catch {
      // AI : addProject already sets saveError — keep the spinner from hanging.
    } finally {
      setBusy(null)
    }
  }

  async function handleCloneTemplate(templateId: ProjectId) {
    setBusy(templateId)
    try {
      await cloneFromTemplate(templateId, { open: false })
    } catch {
      /* saveError banner */
    } finally {
      setBusy(null)
    }
  }

  async function handleCloneProject(id: string) {
    setBusy(`clone-${id}`)
    try {
      await cloneProject(id, { open: false })
    } catch {
      /* saveError banner */
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

  async function handleCreateWebsite() {
    if (busy === "website") return
    setBusy("website")
    setResyncMsg(null)
    try {
      const stub = await addProject({ open: false })
      const body = await apiJson<{ url: string; link: SharedLinkRecord }>(API_ROUTES.sharedLinks, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          projectId: stub.id,
          kind: "site",
          siteOptions: normalizeHostedSiteOptions(
            hostedSiteOptionsForCreate({ name: "", pipelineIds: [], projects }),
          ),
        }),
      })
      setSites((prev) => [body.link, ...prev.filter((s) => s.id !== body.link.id)])
      handleOpenWebsite(body.link)
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
        primarySection={pickerPrimarySection}
        openingSection={openingSection}
        onPrimarySectionChange={(section) => {
          wrapPrimarySectionChange(section, pickerPrimarySection, beginOpening, () => {
            if (section === AppPrimarySection.Build || section === AppPrimarySection.Vibe) {
              // AI : Vibe is Build sub-surface — picker stays until a project is opened.
              if (section === AppPrimarySection.Vibe) setActiveWindow(AppWindowId.Vibe)
              navigateToBuildMode()
              markSectionReady(AppPrimarySection.Build)
              return
            }
            if (section === AppPrimarySection.Run) {
              navigateToRunMode()
              return
            }
            if (section === AppPrimarySection.Billing || section === AppPrimarySection.Settings) {
              setActiveWindow(section)
              navigateToRunMode()
              markSectionReady(section)
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
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {listTab === "pipelines" ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent"
                    onClick={() => void handleResync()}
                    disabled={busy === "resync"}
                    spineId="project.resync-examples"
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
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => void handleCreateWebsite()}
                  disabled={busy === "website"}
                  spineId="website.create"
                >
                  {busy === "website" ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LayoutTemplate className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  New website
                </Button>
              )}
            </div>
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {resyncMsg && (
            <p className="mb-4 rounded-md border border-border bg-secondary/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
              {resyncMsg}
            </p>
          )}

          <div className="mb-4 flex gap-1 rounded-md border border-border bg-muted/30 p-1 max-w-md">
            <button
              type="button"
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                listTab === "pipelines"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => selectList("pipelines")}
              data-spine-id="nav.picker.pipelines"
            >
              <FolderKanban className="h-3.5 w-3.5" />
              Pipelines
              <span className="font-mono text-[10px] text-muted-foreground">({projects.length})</span>
            </button>
            <button
              type="button"
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                listTab === "websites"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => selectList("websites")}
              data-spine-id="nav.picker.websites"
            >
              <Globe className="h-3.5 w-3.5" />
              Websites
              <span className="font-mono text-[10px] text-muted-foreground">({sites.length})</span>
            </button>
          </div>

          {listTab === "websites" ? (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Your websites</h3>
                <span className="font-mono text-[10px] text-muted-foreground">({sites.length})</span>
              </div>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {sitesLoading && sites.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading websites…</li>
                ) : sites.length === 0 ? (
                  <li className="px-4 py-8 text-center">
                    <p className="text-sm text-muted-foreground">No websites yet.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      New website starts as a page. Attach a pipeline later if you need a run form.
                    </p>
                  </li>
                ) : (
                  sites.map((site) => {
                    const bound = listedWebsitePipelineBindings(site.siteOptions.pipelineBindings)
                    const names = bound
                      .map((b) => projects.find((p) => p.id === b.projectId)?.name ?? b.alias)
                      .join(", ")
                    return (
                      <li key={site.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">
                              {websiteDisplayName(site)}
                            </span>
                            <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                              {site.siteOptions.runtime === "react" ? "react" : "html"}
                            </span>
                          </div>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {bound.length === 0
                              ? "No pipelines yet"
                              : `${bound.length} pipeline${bound.length === 1 ? "" : "s"} · ${names}`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="h-8"
                          onClick={() => handleOpenWebsite(site)}
                          disabled={openingId !== null || busy !== null}
                          spineId="website.open"
                        >
                          {openingId === site.projectId ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Open
                        </Button>
                      </li>
                    )
                  })
                )}
              </ul>
            </section>
          ) : (
          <>
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Your pipelines</h3>
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
                            {p.teamId ? (
                              <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                                {p.teamReadOnly ? "shared · view" : "shared"}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {p.kind} · {p.modules.length} steps · {p.modules.filter((m) => m.kind === "input").length}{" "}
                            input
                            {p.modules.some((m) => m.inputNameContains) ? " · name rules" : ""}
                            {(siteCountByProject.get(p.id) ?? 0) > 0
                              ? ` · ${siteCountByProject.get(p.id)} website${siteCountByProject.get(p.id) === 1 ? "" : "s"}`
                              : ""}
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
                        spineId="project.open"
                      >
                        {openingId === p.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Open
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => startEdit(p)} aria-label={`Rename ${p.name}`} spineId="project.rename">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleCloneProject(p.id)}
                        disabled={busy === `clone-${p.id}`}
                        aria-label={`Clone ${p.name}`}
                        spineId="project.clone"
                      >
                        {busy === `clone-${p.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      {quickDelete ? (
                        <DeleteButton
                          variant="ghost"
                          size="icon-sm"
                          deleting={deleting}
                          label={`Delete ${p.name}`}
                          spineId="project.delete"
                          onClick={() => void runDelete(p, sortedProjects, () => deleteProject(p.id))}
                        />
                      ) : null}
                    </div>
                  </AnimatedRemovalItem>
                )
              })}
            </ul>
          </section>

          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{ShareTabLabel.SharedWithMe}</h3>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Paste a share link to run someone else&apos;s pipeline — billing stays in your account.
            </p>
            <div className="max-w-2xl">
              <SharedWithMePanel embedded onRun={handleRunShared} />
            </div>
          </section>

          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{ShareTabLabel.Marketplace}</h3>
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
              cloneLabel="Clone"
            />
          </section>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
