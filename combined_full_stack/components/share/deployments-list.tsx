"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, Globe, Loader2, Power, RefreshCw, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import type { HostedApiRecord } from "@/lib/hosted-api-types"
import { formatCents } from "@/lib/format"
import { viewerFundsSharedRun } from "@/lib/shared-link-funding"
import type { SharedLinkRecord } from "@/lib/shared-link-types"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { copyTextToClipboard } from "@/lib/clipboard"

type DeploymentRow =
  | { kind: "link"; row: SharedLinkRecord }
  | { kind: "api"; row: HostedApiRecord }

function linkUrl(id: string): string {
  if (typeof window === "undefined") return `/run/${id}`
  return `${window.location.origin}/run/${id}`
}

function apiInvokeUrl(id: string): string {
  if (typeof window === "undefined") return API_ROUTES.hostedApiInvoke(id)
  return `${window.location.origin}${API_ROUTES.hostedApiInvoke(id)}`
}

function spendLabel(spent: number, limit?: number): string {
  if (limit == null) return `${formatCents(spent)} spent`
  return `${formatCents(spent)} / ${formatCents(limit)}`
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

export function DeploymentsList({ refreshToken = 0 }: { refreshToken?: number }) {
  const [busy, setBusy] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [links, setLinks] = useState<SharedLinkRecord[]>([])
  const [apis, setApis] = useState<HostedApiRecord[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

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

  const liveRows: DeploymentRow[] = [
    ...links.filter((l) => !l.revoked).map((row) => ({ kind: "link" as const, row })),
    ...apis.filter((a) => !a.revoked).map((row) => ({ kind: "api" as const, row })),
  ].sort((a, b) => b.row.createdAt - a.row.createdAt)

  async function takeDown(kind: "link" | "api", id: string) {
    setRevoking(id)
    setError(null)
    try {
      const route = kind === "link" ? API_ROUTES.sharedLink(id) : API_ROUTES.hostedApi(id)
      await apiJson(route, { method: "DELETE" })
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRevoking(null)
    }
  }

  async function copyUrl(text: string, id: string) {
    await copyTextToClipboard(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), COPY_FEEDBACK_MS)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Live deployments</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Monitor usage and take down shared links or hosted APIs.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {liveRows.length === 0 && !busy ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
          No live deployments for this project yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {liveRows.map((item) => {
            const { row } = item
            const isLink = item.kind === "link"
            const url = isLink ? linkUrl(row.id) : apiInvokeUrl(row.id)
            const runs = isLink ? (row as SharedLinkRecord).runCount : (row as HostedApiRecord).requestCount
            const limit = row.spendLimitCents
            const spent = row.totalSpendCents
            const atLimit = limit != null && spent >= limit

            return (
              <li key={`${item.kind}-${row.id}`} className="rounded-md border border-border bg-muted/10 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isLink ? (
                        <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <Zap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate text-xs font-medium">{row.name}</span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                        {isLink ? "link" : "api"}
                      </span>
                      {atLimit && (
                        <span className="shrink-0 rounded bg-destructive/15 px-1.5 py-0.5 text-[9px] text-destructive">
                          limit reached
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {runs} {isLink ? "runs" : "requests"} · {spendLabel(spent, limit)}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {isLink
                        ? linkFundingLabel(row as SharedLinkRecord)
                        : `${(row as HostedApiRecord).fundingMode === "caller_pays" ? "caller pays" : "you pay"} · ${pricingLabel(
                            (row as HostedApiRecord).billingMultiple,
                            (row as HostedApiRecord).flatFeeCents,
                          )}`}
                      {!isLink && ` · key ${(row as HostedApiRecord).apiKeyPrefix}…`}
                    </p>
                    <code className="mt-1 block truncate font-mono text-[9px] text-foreground/80">{url}</code>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      onClick={() => void copyUrl(url, row.id)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={revoking === row.id}
                      onClick={() => void takeDown(item.kind, row.id)}
                    >
                      {revoking === row.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Power className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
