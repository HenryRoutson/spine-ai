"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, Globe, Loader2, PanelTop, Power, RefreshCw, ScrollText, Trash2, TrendingDown, TrendingUp, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DeploymentSpendLimitEditor } from "@/components/share/deployment-monitor"
import type { ActivityFilter } from "@/components/share/deployment-activity-page"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import {
  deploymentIsAsset,
  deploymentIsLiability,
  deploymentRowsForProject,
  liveDeploymentRows,
  partitionDeploymentRows,
  type DeploymentKind,
  type DeploymentRow,
} from "@/lib/deployment-funding"
import type { HostedApiRecord } from "@/lib/hosted-api-types"
import { formatCents } from "@/lib/format"
import { callerFundsHostedApi } from "@/lib/hosted-api-funding"
import { viewerFundsSharedRun } from "@/lib/shared-link-funding"
import type { SharedLinkRecord } from "@/lib/shared-link-types"
import { copyTextToClipboard } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

function linkUrl(id: string): string {
  if (typeof window === "undefined") return `/run/${id}`
  return `${window.location.origin}/run/${id}`
}

function embedUrl(id: string): string {
  if (typeof window === "undefined") return `/embed/${id}`
  return `${window.location.origin}/embed/${id}`
}

function apiInvokeUrl(id: string): string {
  if (typeof window === "undefined") return API_ROUTES.hostedApiInvoke(id)
  return `${window.location.origin}${API_ROUTES.hostedApiInvoke(id)}`
}

function deploymentUrl(item: DeploymentRow): string {
  if (item.kind === "api") return apiInvokeUrl(item.row.id)
  if (item.kind === "embed") return embedUrl(item.row.id)
  return linkUrl(item.row.id)
}

function spendLabel(amount: number, limit: number | undefined, isAsset: boolean): string {
  const verb = isAsset ? "earned" : "spent"
  if (limit == null) return `${formatCents(amount)} ${verb}`
  return `${formatCents(amount)} / ${formatCents(limit)}`
}

function pricingLabel(multiple: number, flatFeeCents: number): string {
  const parts: string[] = []
  if (multiple > 1) parts.push(`${multiple}× LLM cost`)
  if (flatFeeCents > 0) parts.push(`$${(flatFeeCents / 100).toFixed(2)} flat`)
  return parts.length ? parts.join(" · ") : "at cost"
}

function linkFundingLabel(row: SharedLinkRecord): string {
  if (viewerFundsSharedRun(row.fundingMode)) {
    return `viewer pays · ${pricingLabel(row.billingMultiple, row.flatFeeCents)}`
  }
  if (row.fundingMode === "viewer_signs_in") return "you pay · sign in required"
  return "you pay · no sign in"
}

function DeploymentRowCard({
  item,
  revoking,
  toggling,
  isLiability,
  simple,
  onCopy,
  onToggleEnabled,
  onTakeDown,
  onRefresh,
  onViewActivity,
}: {
  item: DeploymentRow
  revoking: string | null
  toggling: string | null
  isLiability: boolean
  simple: boolean
  onCopy: (url: string) => void
  onToggleEnabled: (kind: DeploymentKind, id: string, enabled: boolean) => void
  onTakeDown: (kind: DeploymentKind, id: string) => void
  onRefresh: () => void
  onViewActivity: (filter: ActivityFilter) => void
}) {
  const { row } = item
  const isAsset = deploymentIsAsset(item)
  const isApi = item.kind === "api"
  const isEmbed = item.kind === "embed"
  const isEnabled = row.enabled !== false
  const url = deploymentUrl(item)
  const callCount = isApi ? (row as HostedApiRecord).requestCount : (row as SharedLinkRecord).runCount
  const limit = row.spendLimitCents
  const spent = row.totalSpendCents
  const atLimit = limit != null && spent >= limit
  const actionBusy = revoking === row.id || toggling === row.id
  const kindLabel = isApi ? "api" : isEmbed ? "embed" : "link"
  const origins = !isApi ? (row as SharedLinkRecord).allowedOrigins ?? [] : []

  return (
    <li
      className={cn(
        "rounded-md border border-border bg-muted/10 p-3",
        !isEnabled && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {isApi ? (
              <Zap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : isEmbed ? (
              <PanelTop className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate text-xs font-medium">{row.name}</span>
            {simple ? null : (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                {kindLabel}
              </span>
            )}
            {atLimit && (
              <span className="shrink-0 rounded bg-destructive/15 px-1.5 py-0.5 text-[9px] text-destructive">
                limit reached
              </span>
            )}
            {!isEnabled && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                disabled
              </span>
            )}
          </div>
          <p className={cn("mt-1 text-muted-foreground", simple ? "text-xs" : "font-mono text-[10px]")}>
            {callCount} {isApi ? "requests" : "runs"}
            {simple ? ` · ${formatCents(spent)} used` : ` · ${spendLabel(spent, limit, isAsset)}`}
          </p>
          {simple ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {viewerFundsSharedRun((row as SharedLinkRecord).fundingMode) ? "They pay" : "You pay"}
            </p>
          ) : (
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              {isApi
                ? `${callerFundsHostedApi((row as HostedApiRecord).fundingMode) ? "caller pays" : "you pay"} · ${pricingLabel(
                    (row as HostedApiRecord).billingMultiple,
                    (row as HostedApiRecord).flatFeeCents,
                  )} · key ${(row as HostedApiRecord).apiKeyPrefix}…`
                : linkFundingLabel(row as SharedLinkRecord)}
            </p>
          )}
          {simple || !isEmbed || origins.length === 0 ? null : (
            <p className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">
              origins: {origins.join(", ")}
            </p>
          )}
          <code className="mt-1 block truncate font-mono text-[9px] text-foreground/80">{url}</code>
          {simple || !isLiability ? null : (
            <DeploymentSpendLimitEditor item={item} onSaved={() => void onRefresh()} />
          )}
          {simple ? null : (
            <Button
              size="sm"
              variant="link"
              className="mt-1 h-auto gap-1 p-0 text-[10px] text-muted-foreground"
              onClick={() => onViewActivity({ kind: item.kind, id: row.id })}
            >
              <ScrollText className="h-3 w-3" />
              View runs &amp; callers
            </Button>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2"
            onClick={() => void onCopy(url)}
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-7 px-2",
              isEnabled
                ? "text-foreground"
                : "border-amber-500/40 text-amber-600 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400",
            )}
            disabled={actionBusy}
            title={isEnabled ? (simple ? "Pause" : "Temporarily disable") : simple ? "Resume" : "Re-enable"}
            onClick={() => void onToggleEnabled(item.kind, row.id, !isEnabled)}
          >
            {toggling === row.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Power className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={actionBusy}
            title={simple ? "Delete link" : "Delete deployment"}
            onClick={() => void onTakeDown(item.kind, row.id)}
          >
            {revoking === row.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
    </li>
  )
}

function DeploymentSection({
  title,
  description,
  icon: Icon,
  rows,
  revoking,
  toggling,
  simple = false,
  onCopy,
  onToggleEnabled,
  onTakeDown,
  onRefresh,
  onViewActivity,
  emptyMessage,
}: {
  title: string
  description: string
  icon: typeof TrendingUp
  rows: DeploymentRow[]
  revoking: string | null
  toggling: string | null
  simple?: boolean
  onCopy: (url: string) => void
  onToggleEnabled: (kind: DeploymentKind, id: string, enabled: boolean) => void
  onTakeDown: (kind: DeploymentKind, id: string) => void
  onRefresh: () => void
  onViewActivity: (filter: ActivityFilter) => void
  emptyMessage: string
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div>
          <h4 className="text-xs font-semibold">{title}</h4>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{description}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[10px] text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((item) => (
            <DeploymentRowCard
              key={`${item.kind}-${item.row.id}`}
              item={item}
              revoking={revoking}
              toggling={toggling}
              isLiability={deploymentIsLiability(item)}
              simple={simple}
              onCopy={onCopy}
              onToggleEnabled={onToggleEnabled}
              onTakeDown={onTakeDown}
              onRefresh={onRefresh}
              onViewActivity={onViewActivity}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

export function DeploymentsList({
  projectId,
  refreshToken = 0,
  onViewActivity,
  simple = false,
}: {
  projectId: string
  refreshToken?: number
  onViewActivity?: (filter: ActivityFilter) => void
  simple?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [links, setLinks] = useState<SharedLinkRecord[]>([])
  const [apis, setApis] = useState<HostedApiRecord[]>([])

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const [linksRes, apisRes] = await Promise.all([
        apiJson<{ links: SharedLinkRecord[] }>(API_ROUTES.sharedLinks),
        apiJson<{ apis: HostedApiRecord[] }>(API_ROUTES.hostedApis),
      ])
      setLinks(linksRes.links)
      setApis(apisRes.apis)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  const projectRows = useMemo(
    () => deploymentRowsForProject(liveDeploymentRows(links, apis), projectId),
    [links, apis, projectId],
  )
  const { assets, liabilities } = useMemo(() => partitionDeploymentRows(projectRows), [projectRows])
  const linkRows = useMemo(() => projectRows.filter((row) => row.kind === "link"), [projectRows])

  async function takeDown(kind: DeploymentKind, id: string) {
    if (
      !window.confirm(
        simple
          ? "Delete this link? People who have it won't be able to open it anymore."
          : "Delete this deployment permanently? This cannot be undone.",
      )
    )
      return
    setRevoking(id)
    setError(null)
    try {
      const route = kind === "api" ? API_ROUTES.hostedApi(id) : API_ROUTES.sharedLink(id)
      await apiJson(route, { method: "DELETE" })
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRevoking(null)
    }
  }

  async function toggleEnabled(kind: DeploymentKind, id: string, enabled: boolean) {
    setToggling(id)
    setError(null)
    try {
      const route = kind === "api" ? API_ROUTES.hostedApi(id) : API_ROUTES.sharedLink(id)
      await apiJson(route, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ enabled }),
      })
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setToggling(null)
    }
  }

  async function copyUrl(text: string) {
    await copyTextToClipboard(text)
  }

  function viewActivity(filter: ActivityFilter) {
    onViewActivity?.(filter)
  }

  const hasAny = simple ? linkRows.length > 0 : assets.length + liabilities.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{simple ? "Your links" : "Live deployments"}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {simple
              ? "Copy, pause, or delete links you've already created."
              : "Assets earn from viewers or callers; liabilities spend your credits."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!hasAny && !busy ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
          {simple ? "No links yet — create one above." : "No live deployments for this project yet."}
        </p>
      ) : simple ? (
        <ul className="space-y-2">
          {linkRows.map((item) => (
            <DeploymentRowCard
              key={`${item.kind}-${item.row.id}`}
              item={item}
              revoking={revoking}
              toggling={toggling}
              isLiability={deploymentIsLiability(item)}
              simple
              onCopy={copyUrl}
              onToggleEnabled={toggleEnabled}
              onTakeDown={takeDown}
              onRefresh={load}
              onViewActivity={viewActivity}
            />
          ))}
        </ul>
      ) : (
        <div className="space-y-5">
          <DeploymentSection
            title="Assets"
            description="Viewer- or caller-funded — markup above LLM cost goes to Earnings."
            icon={TrendingUp}
            rows={assets}
            revoking={revoking}
            toggling={toggling}
            onCopy={copyUrl}
            onToggleEnabled={toggleEnabled}
            onTakeDown={takeDown}
            onRefresh={load}
            onViewActivity={viewActivity}
            emptyMessage="No monetized links or APIs yet."
          />
          <DeploymentSection
            title="Liabilities"
            description="You pay each run — set spend limits to cap exposure."
            icon={TrendingDown}
            rows={liabilities}
            revoking={revoking}
            toggling={toggling}
            onCopy={copyUrl}
            onToggleEnabled={toggleEnabled}
            onTakeDown={takeDown}
            onRefresh={load}
            onViewActivity={viewActivity}
            emptyMessage="No owner-funded links or APIs yet."
          />
        </div>
      )}
    </div>
  )
}
