"use client"
// AI : parity ids — share.marketplace-clone

import { useCallback, useContext, useEffect, useState } from "react"
import { Loader2, Search, Store, Trash2 } from "lucide-react"
import {
  MarketplaceDetailSkeleton,
  MarketplaceListSkeleton,
} from "@/components/account-panel-skeletons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { openProjectInWorkspace } from "@/lib/active-project-session"
import { ProjectPickerContext } from "@/lib/store"
import { readMarketplaceSnapshot } from "@/lib/marketplace-snapshot-cache"
import { seedProjectInStateSnapshot } from "@/lib/state-snapshot-cache"
import { fetchMarketplaceListings } from "@/lib/warm-run-data"
import { formatCents } from "@/lib/format"
import type {
  MarketplaceListingCard,
  MarketplaceListingDetail,
  MarketplaceListingKind,
} from "@/lib/marketplace-types"
import type { SharedLinkRecord } from "@/lib/shared-link-types"
import { listedWebsitePipelineBindings } from "@/lib/website-pipelines"
import type { Project, ProjectId } from "@/lib/types"
import { cn } from "@/lib/utils"

function priceLabel(cents: number): string {
  return cents <= 0 ? "Free" : formatCents(cents)
}

export function MarketplaceBrowsePanel({
  embedded = false,
  simple = false,
  kind,
  onClonedSite,
}: {
  // AI : when true, parent page supplies the section heading (projects tab).
  embedded?: boolean
  simple?: boolean
  kind?: MarketplaceListingKind
  onClonedSite?: (site: SharedLinkRecord) => void
}) {
  const [query, setQuery] = useState("")
  const [listings, setListings] = useState<MarketplaceListingCard[]>(
    () => (kind ? [] : readMarketplaceSnapshot() ?? []),
  )
  const [loading, setLoading] = useState(() => !kind && readMarketplaceSnapshot() == null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<MarketplaceListingDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const picker = useContext(ProjectPickerContext)

  const load = useCallback(async (q: string) => {
    const cached = !q.trim() && !kind ? readMarketplaceSnapshot() : null
    if (cached) setListings(cached)
    setLoading(!cached && !q.trim())
    setError(null)
    try {
      const next = await fetchMarketplaceListings(q, kind)
      setListings(next)
    } catch (e) {
      if (!cached) setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [kind])

  useEffect(() => {
    void load("")
  }, [load])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    void apiJson<{ listing: MarketplaceListingDetail }>(API_ROUTES.marketplaceListing(selectedId))
      .then((body) => {
        if (!cancelled) setDetail(body.listing)
      })
      .catch((e) => {
        if (!cancelled) setActionError((e as Error).message)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  async function search() {
    await load(query)
  }

  async function cloneListing(id: string) {
    setBusyId(id)
    setActionError(null)
    try {
      const body = await apiJson<{
        project?: Project | null
        site?: SharedLinkRecord | null
        chargedCents: number
      }>(API_ROUTES.marketplaceClone(id), { method: "POST", headers: JSON_HEADERS })
      if (body.project) {
        if (picker) picker.ingestCreatedProject(body.project)
        else seedProjectInStateSnapshot(body.project)
        if (!embedded && !body.site) openProjectInWorkspace(body.project.id as ProjectId)
      }
      if (body.site) onClonedSite?.(body.site)
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  async function unpublish(id: string) {
    setBusyId(id)
    setActionError(null)
    try {
      await apiJson(API_ROUTES.marketplaceListing(id), { method: "DELETE" })
      if (selectedId === id) setSelectedId(null)
      await load(query)
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className={cn("flex flex-col gap-4", !embedded && "mx-auto max-w-6xl")}>
      {!embedded ? (
        <div>
          <h3 className="text-sm font-semibold">Marketplace</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {simple
              ? "Copy a ready-made project into your workspace."
              : kind === "website"
                ? "Search published websites and copy one into your workspace to edit independently."
                : "Search published pipelines and copy one into your workspace to edit independently."}
          </p>
        </div>
      ) : null}

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void search()
            }}
            placeholder="Search title or description…"
            className="h-9 pl-8 text-xs"
          />
        </div>
        <Button size="sm" variant="secondary" onClick={() => void search()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {actionError && <p className="text-xs text-destructive">{actionError}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {loading && listings.length === 0 ? (
            <MarketplaceListSkeleton />
          ) : listings.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {simple ? "Nothing here yet." : "No listings yet — publish from the Share tab."}
            </p>
          ) : (
            listings.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                  selectedId === row.id
                    ? "border-foreground/30 bg-secondary"
                    : "border-border bg-card hover:bg-muted/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.title}</p>
                    {row.description ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {row.description}
                      </p>
                    ) : null}
                    <p className={cn("mt-1 text-muted-foreground", simple ? "text-xs" : "font-mono text-[10px]")}>
                      {row.kind === "website" ? "website" : "pipeline"} · {row.stepCount}{" "}
                      {row.kind === "website" ? "parts" : "steps"} · {row.cloneCount} copies
                      {row.isOwner ? " · yours" : ""}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px]", !simple && "font-mono")}>
                    {priceLabel(row.priceCents)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          {!selectedId ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              {simple ? "Pick one to preview." : "Select a listing to preview and copy."}
            </p>
          ) : detailLoading || !detail ? (
            <MarketplaceDetailSkeleton />
          ) : (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold">{detail.title}</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {detail.description || "No description"}
                </p>
              </div>
              <p className={cn("text-muted-foreground", simple ? "text-xs" : "font-mono text-[10px]")}>
                {simple
                  ? `${detail.stepCount} steps · ${priceLabel(detail.priceCents)}`
                  : `Snapshot · ${detail.stepCount} steps · ${priceLabel(detail.priceCents)}`}
              </p>
              {simple ? null : detail.kind === "website" ? (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/20 p-2">
                  {(detail.siteOptions?.actions ?? []).map((action) => (
                    <li key={action.alias} className="font-mono text-[10px] text-muted-foreground">
                      <span className="text-foreground">{action.label || action.alias}</span>
                      <span className="ml-1 opacity-60">
                        ({action.functionId ?? action.table ?? "action"})
                      </span>
                    </li>
                  ))}
                  {listedWebsitePipelineBindings(detail.siteOptions?.pipelineBindings ?? []).map((b) => (
                    <li key={b.alias} className="font-mono text-[10px] text-muted-foreground">
                      <span className="text-foreground">{b.alias}</span>
                      <span className="ml-1 opacity-60">({b.functionId ?? b.projectId})</span>
                    </li>
                  ))}
                  {(detail.siteOptions?.actions ?? []).length === 0 &&
                  listedWebsitePipelineBindings(detail.siteOptions?.pipelineBindings ?? []).length === 0 ? (
                    <li className="text-[10px] text-muted-foreground">Page-only site</li>
                  ) : null}
                </ul>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/20 p-2">
                  {detail.snapshot.modules.map((m) => (
                    <li key={m.id} className="font-mono text-[10px] text-muted-foreground">
                      <span className="text-foreground">{m.label || m.kind}</span>
                      <span className="ml-1 opacity-60">({m.kind})</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {detail.isOwner ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-destructive"
                    disabled={busyId === detail.id}
                    onClick={() => void unpublish(detail.id)}
                  >
                    {busyId === detail.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Unpublish
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={busyId === detail.id}
                    onClick={() => void cloneListing(detail.id)}
                    spineId="share.marketplace-clone"
                  >
                    {busyId === detail.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Store className="h-3.5 w-3.5" />
                    )}
                    {detail.priceCents > 0
                      ? `Copy for ${formatCents(detail.priceCents)}`
                      : simple
                        ? "Copy"
                        : "Copy to workspace"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
