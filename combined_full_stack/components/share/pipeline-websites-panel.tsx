"use client"

import { useCallback, useEffect, useState } from "react"
import { Globe, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { DEFAULT_HOSTED_SITE_HTML, isSiteLinkId, normalizeHostedSiteOptions } from "@/lib/hosted-site"
import type { SharedLinkRecord } from "@/lib/shared-link-types"
import type { Project } from "@/lib/types"
import { bindingsFromProjectIds, websiteBoundProjectIds, websiteDisplayName } from "@/lib/website-pipelines"
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
      const mine = (body.links ?? []).filter((link) => {
        if (!isSiteLinkId(link.id) || link.revoked) return false
        return websiteBoundProjectIds(link.projectId, link.siteOptions.pipelineBindings ?? []).includes(project.id)
      })
      setSites(mine)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [project.id])

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
          siteOptions: normalizeHostedSiteOptions({
            brand: { companyName: project.name, tagline: "Run attached pipelines" },
            customHtml: DEFAULT_HOSTED_SITE_HTML,
            pipelineBindings: bindingsFromProjectIds([project.id], projects),
          }),
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

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Websites</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This pipeline can appear on one or more vibe-coded websites. Edit the page there — Share here is just the run link.
          </p>
        </div>
        <Button size="sm" className="h-8 shrink-0 gap-1" onClick={() => void createWebsite()} disabled={busy} spineId="website.create">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          New website
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {loading && sites.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Loading websites…</p>
      ) : sites.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
          No websites use this pipeline yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {sites.map((site) => (
            <li key={site.id} className="flex items-center gap-3 px-3 py-2">
              <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">
                {websiteDisplayName(site)}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => {
                  openWebsiteEditor(site)
                  if (store && site.projectId !== project.id) store.setActiveProjectId(site.projectId)
                }}
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
