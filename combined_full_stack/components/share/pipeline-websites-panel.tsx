"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Globe, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { isSiteLinkId, normalizeHostedSiteOptions } from "@/lib/hosted-site"
import type { SharedLinkRecord } from "@/lib/shared-link-types"
import type { Project } from "@/lib/types"
import { spineActionProps } from "@/lib/core/parity"
import {
  bindingsFromProjectIds,
  hostedSiteOptionsForCreate,
  insertWebsitePipelineInCode,
  websiteBoundProjectIds,
  websiteDisplayName,
} from "@/lib/website-pipelines"
import { useAppShell } from "@/lib/app-shell"
import { useOptionalStore } from "@/lib/store"

export function PipelineWebsitesPanel({
  project,
  projects,
}: {
  project: Project
  projects: Pick<Project, "id" | "name">[]
}) {
  const { openWebsiteEditor } = useAppShell()
  const store = useOptionalStore()
  const [sites, setSites] = useState<SharedLinkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const body = await apiJson<{ links: SharedLinkRecord[] }>(API_ROUTES.sharedLinks)
      setSites((body.links ?? []).filter((link) => isSiteLinkId(link.id) && !link.revoked))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const attached = useMemo(
    () =>
      sites.filter((site) =>
        websiteBoundProjectIds(site.projectId, site.siteOptions.pipelineBindings ?? []).includes(project.id),
      ),
    [project.id, sites],
  )
  const available = useMemo(
    () =>
      sites.filter(
        (site) =>
          !websiteBoundProjectIds(site.projectId, site.siteOptions.pipelineBindings ?? []).includes(project.id),
      ),
    [project.id, sites],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function createWebsite() {
    setBusy(true)
    setError(null)
    try {
      const body = await apiJson<{ link: SharedLinkRecord }>(API_ROUTES.sharedLinks, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          projectId: project.id,
          kind: "site",
          siteOptions: normalizeHostedSiteOptions(
            hostedSiteOptionsForCreate({
              name: project.name,
              pipelineIds: [project.id],
              projects,
            }),
          ),
        }),
      })
      openWebsiteEditor(body.link)
      if (store && body.link.projectId !== project.id) store.setActiveProjectId(body.link.projectId)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function openSite(site: SharedLinkRecord) {
    openWebsiteEditor(site)
    if (store && site.projectId !== project.id) store.setActiveProjectId(site.projectId)
  }

  async function addToWebsite(site: SharedLinkRecord) {
    setBusy(true)
    setError(null)
    try {
      const currentIds = websiteBoundProjectIds(site.projectId, site.siteOptions.pipelineBindings ?? [])
      if (currentIds.includes(project.id)) {
        openSite(site)
        return
      }
      const pipelineBindings = bindingsFromProjectIds([...currentIds, project.id], projects)
      const added = pipelineBindings.find((b) => b.projectId === project.id)
      if (!added) return
      const siteOptions = insertWebsitePipelineInCode(
        { ...normalizeHostedSiteOptions(site.siteOptions), pipelineBindings },
        added.alias,
      )
      const body = await apiJson<{ link: SharedLinkRecord }>(API_ROUTES.sharedLink(site.id), {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ siteOptions }),
      })
      openSite(body.link)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Website</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Websites can include many pipelines. Create one, or add this pipeline to a website you already have.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="h-8 gap-1"
          onClick={() => void createWebsite()}
          disabled={busy}
          spineId="share.create-site"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Create a website
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            type="button"
            disabled={busy || loading}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            {...spineActionProps("website.add-pipeline")}
          >
            <Globe className="h-3.5 w-3.5" />
            Add to a website
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="z-[80] w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-mono text-[10px] uppercase">
                Add this pipeline to
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {available.length === 0 ? (
                <DropdownMenuItem disabled className="font-mono text-[11px] text-muted-foreground">
                  {sites.length === 0 ? "No websites yet" : "Already on every website"}
                </DropdownMenuItem>
              ) : (
                available.map((site) => (
                  <DropdownMenuItem
                    key={site.id}
                    className="font-mono text-xs"
                    onClick={() => void addToWebsite(site)}
                    {...spineActionProps("website.open")}
                  >
                    {websiteDisplayName(site)}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {loading && attached.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Loading websites…</p>
      ) : attached.length === 0 ? null : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {attached.map((site) => (
            <li key={site.id} className="flex items-center gap-3 px-3 py-2">
              <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">
                {websiteDisplayName(site)}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => openSite(site)}
                spineId="website.open"
              >
                Open
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
