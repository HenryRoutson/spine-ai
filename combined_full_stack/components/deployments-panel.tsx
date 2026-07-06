"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, Copy, Globe, Loader2, Power, RefreshCw, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import type { HostedApiRecord } from "@/lib/hosted-api-types"
import { formatCents } from "@/lib/format"
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

export function DeploymentsPanel({ refreshToken = 0 }: { refreshToken?: number }) {
  const [open, setOpen] = useState(false)
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
    if (!open) return
    void load()
  }, [open, load, refreshToken])

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
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 bg-transparent"
        onClick={() => setOpen((o) => !o)}
      >
        <Activity className="h-3.5 w-3.5" />
        Live deploys
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-4 shadow-lg">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Live links & APIs</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Monitor usage and take down shared links or hosted APIs.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => void load()} disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

          {liveRows.length === 0 && !busy ? (
            <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
              No live deployments — use Share link or Host API to publish.
            </p>
          ) : (
            <ul className="max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto">
              {liveRows.map((item) => {
                const { row } = item
                const isLink = item.kind === "link"
                const url = isLink ? linkUrl(row.id) : apiInvokeUrl(row.id)
                const runs = isLink ? (row as SharedLinkRecord).runCount : (row as HostedApiRecord).requestCount
                const limit = row.spendLimitCents
                const spent = row.totalSpendCents
                const atLimit = limit != null && spent >= limit

                return (
                  <li
                    key={`${item.kind}-${row.id}`}
                    className="rounded-md border border-border bg-muted/10 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
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
                        {!isLink && (
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            key {(row as HostedApiRecord).apiKeyPrefix}…
                          </p>
                        )}
                        <code className="mt-1 block truncate font-mono text-[9px] text-foreground/80">{url}</code>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => void copyUrl(url, row.id)}
                        >
                          {copiedId === row.id ? (
                            <Copy className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3 opacity-60" />
                          )}
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
      )}
    </div>
  )
}
