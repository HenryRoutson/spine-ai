"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Copy,
  FolderKanban,
  Globe,
  LayoutTemplate,
  Loader2,
  Pencil,
  RefreshCw,
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
import { LibraryShelf } from "@/components/library-shelf"
import {
  BlankProjectButton,
  ExampleTemplateGrid,
} from "@/components/project-workspace-sections"
import { MarketplaceBrowsePanel } from "@/components/share/marketplace-browse-panel"
import { SharedWithMePanel } from "@/components/share/shared-with-me-panel"
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
  overlayOptimisticSites,
  websiteDisplayName,
  websiteNameForCreate,
  websitesUsingProject,
  type pipeline_website_delete_action,
  type website_dependent,
} from "@/lib/website-pipelines"
import { consumePendingPickerList, readPickerList, pickerHomeHref, type picker_list_tab } from "@/lib/picker-list"
import type { Project, ProjectId } from "@/lib/types"
import { DeletePipelineDialog } from "@/components/delete-pipeline-dialog"

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
  const [newSiteOpen, setNewSiteOpen] = useState(false)
  const [siteName, setSiteName] = useState("")
  const [sitePipelineIds, setSitePipelineIds] = useState<ProjectId[]>([])
  const mintedSitesRef = useRef<SharedLinkRecord[]>([])
  const [pendingDelete, setPendingDelete] = useState<{
    project: Project
    sites: website_dependent[]
  } | null>(null)

  const rememberSites = useCallback((created: SharedLinkRecord[]) => {
    if (!created.length) return
    mintedSitesRef.current = overlayOptimisticSites(
      mintedSitesRef.current.filter((s) => !created.some((c) => c.id === s.id)),
      created,
    )
    setSites((prev) => overlayOptimisticSites(prev, mintedSitesRef.current))
  }, [])

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
        const fetched = (body.links ?? []).filter((link) => isSiteLinkId(link.id) && !link.revoked)
        setSites(overlayOptimisticSites(fetched, mintedSitesRef.current))
      })
      .catch(() => {
        // AI : keep the current list — wiping after clone made the button look dead on prod.
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
      if (link.projectId) {
        setOpeningId(link.projectId)
        openProject(link.projectId)
        return
      }
      navigateToBuildMode()
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
    setResyncMsg(null)
    try {
      await cloneFromTemplate(templateId, {
        open: false,
        onHostedSites: (created, siteError) => {
          if (created.length) rememberSites(created)
          if (listTab !== "websites") return
          if (created[0]) {
            handleOpenWebsite(created[0])
            return
          }
          setResyncMsg(siteError ?? "Cloned the pipeline, but no hosted page was published.")
        },
      })
    } catch (e) {
      setResyncMsg((e as Error).message)
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
    setBusy("website")
    setResyncMsg(null)
    try {
      const name = websiteNameForCreate(siteName)
      const selected = sitePipelineIds
      const body = await apiJson<{ url: string; link: SharedLinkRecord }>(API_ROUTES.sharedLinks, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          ...(selected[0] ? { projectId: selected[0] } : {}),
          kind: "site",
          siteOptions: normalizeHostedSiteOptions(
            hostedSiteOptionsForCreate({ name, pipelineIds: selected, projects }),
          ),
        }),
      })
      rememberSites([body.link])
      setNewSiteOpen(false)
      setSiteName("")
      setSitePipelineIds([])
      handleOpenWebsite(body.link)
    } catch (e) {
      setResyncMsg((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  function requestDelete(p: Project) {
    const bound = websitesUsingProject(sites, p.id)
    if (bound.length > 0) {
      setPendingDelete({ project: p, sites: bound })
      return
    }
    void runDelete(p, sortedProjects, () => deleteProject(p.id))
  }

  function confirmPendingDelete(action: pipeline_website_delete_action) {
    const pending = pendingDelete
    if (!pending) return
    setPendingDelete(null)
    void runDelete(pending.project, sortedProjects, () =>
      deleteProject(pending.project.id, { websiteAction: action }),
    )
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
                  onClick={() => setNewSiteOpen((v) => !v)}
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
              {newSiteOpen ? (
                <div className="mb-4 space-y-3 rounded-lg border border-border bg-card p-4">
                  <p className="text-sm font-medium">New website</p>
                  <p className="text-[11px] text-muted-foreground">
                    Start with a page — like Lovable. Attach pipelines now, or add them later.
                  </p>
                  <Input
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="Company or page name"
                    className="h-8 max-w-sm text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    {sortedProjects.map((p) => {
                      const on = sitePipelineIds.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={cn(
                            "rounded-md border px-2 py-1 text-[11px]",
                            on
                              ? "border-border bg-secondary text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() =>
                            setSitePipelineIds((prev) =>
                              on ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                            )
                          }
                        >
                          {p.name}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void handleCreateWebsite()} disabled={busy === "website"}>
                      Create website
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setNewSiteOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
              <LibraryShelf entity="websites" id="yours" count={sites.length}>
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
              </LibraryShelf>
              <LibraryShelf entity="websites" id="shared">
                <div className="max-w-2xl">
                  <SharedWithMePanel
                    embedded
                    onRun={(id) => {
                      if (isSiteLinkId(id)) {
                        void apiJson<{ link: SharedLinkRecord }>(API_ROUTES.sharedLink(id))
                          .then((body) => handleOpenWebsite(body.link))
                          .catch((e) => setResyncMsg((e as Error).message))
                        return
                      }
                      handleRunShared(id)
                    }}
                  />
                </div>
              </LibraryShelf>
              <LibraryShelf entity="websites" id="marketplace">
                <p className="mb-2 text-[11px] text-muted-foreground">
                  First-class website listings — clone a hosted page and any bound functions.
                </p>
                <MarketplaceBrowsePanel
                  embedded
                  kind="website"
                  onClonedSite={(site) => {
                    rememberSites([site])
                    handleOpenWebsite(site)
                  }}
                />
              </LibraryShelf>
              <LibraryShelf entity="websites" id="templates">
                <ExampleTemplateGrid
                  busyId={busy}
                  hostedOnly
                  onClone={(id) => void handleCloneTemplate(id)}
                  cloneLabel="Clone site"
                />
              </LibraryShelf>
            </section>
          ) : (
          <>
          <LibraryShelf entity="pipelines" id="yours" count={projects.length}>
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
                          onClick={() => requestDelete(p)}
                        />
                      ) : null}
                    </div>
                  </AnimatedRemovalItem>
                )
              })}
            </ul>
          </LibraryShelf>

          <LibraryShelf entity="pipelines" id="shared">
            <div className="max-w-2xl">
              <SharedWithMePanel embedded onRun={handleRunShared} />
            </div>
          </LibraryShelf>

          <LibraryShelf entity="pipelines" id="marketplace">
            <MarketplaceBrowsePanel embedded kind="pipeline" />
          </LibraryShelf>

          <LibraryShelf entity="pipelines" id="templates">
            <ExampleTemplateGrid
              busyId={busy}
              onClone={(id) => void handleCloneTemplate(id)}
              cloneLabel="Clone"
            />
          </LibraryShelf>
          </>
          )}
        </div>
      </div>
      {pendingDelete ? (
        <DeletePipelineDialog
          pipelineName={pendingDelete.project.name}
          sites={pendingDelete.sites}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmPendingDelete}
        />
      ) : null}
    </div>
  )
}
