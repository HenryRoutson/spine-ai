"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Globe, ScrollText, Search, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import type { DeploymentRow } from "@/lib/deployment-funding"
import { liveDeploymentRows, deploymentRowsForProject } from "@/lib/deployment-funding"
import {
  allDeploymentRuns,
  deploymentRunCallerLabel,
  deploymentRunKindLabel,
  deploymentRunTargetId,
  runsForDeployment,
} from "@/lib/deployment-runs"
import type { HostedApiRecord } from "@/lib/hosted-api-types"
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import { useAppShell } from "@/lib/app-shell"
import { runBilledCents, runTotalMs } from "@/lib/run-metrics"
import type { SharedLinkRecord } from "@/lib/shared-link-types"
import { timeAgo } from "@/lib/time-ago"
import { useStore } from "@/lib/store"
import type { PipelineRun } from "@/lib/types"
import { cn } from "@/lib/utils"

export type ActivityFilter = { kind: "link" | "api"; id: string } | null

function deploymentLabel(
  deployments: DeploymentRow[],
  run: PipelineRun,
): string {
  const targetId = deploymentRunTargetId(run)
  if (!targetId) return "Unknown deployment"
  const match = deployments.find((d) => d.row.id === targetId)
  return match?.row.name ?? targetId
}

export function DeploymentActivityPage({
  projectId,
  initialFilter = null,
}: {
  projectId: string
  initialFilter?: ActivityFilter
}) {
  const { billingRuns } = useStore()
  const { openLogging } = useAppShell()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ActivityFilter>(initialFilter)
  const [links, setLinks] = useState<SharedLinkRecord[]>([])
  const [apis, setApis] = useState<HostedApiRecord[]>([])

  const load = useCallback(async () => {
    const [linksRes, apisRes] = await Promise.all([
      apiJson<{ links: SharedLinkRecord[] }>(API_ROUTES.sharedLinks),
      apiJson<{ apis: HostedApiRecord[] }>(API_ROUTES.hostedApis),
    ])
    setLinks(linksRes.links)
    setApis(apisRes.apis)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setFilter(initialFilter)
  }, [initialFilter])

  const deployments = useMemo(
    () => deploymentRowsForProject(liveDeploymentRows(links, apis), projectId),
    [links, apis, projectId],
  )
  const deploymentRuns = useMemo(() => {
    const filteredDeployment = filter
      ? deployments.find((d) => d.kind === filter.kind && d.row.id === filter.id)
      : undefined
    const base = filteredDeployment
      ? runsForDeployment(billingRuns, filteredDeployment)
      : allDeploymentRuns(billingRuns)
    if (!query.trim()) return base
    const q = query.toLowerCase()
    return base.filter(
      (run) =>
        run.id.toLowerCase().includes(q) ||
        deploymentRunCallerLabel(run).toLowerCase().includes(q) ||
        deploymentLabel(deployments, run).toLowerCase().includes(q) ||
        (deploymentRunTargetId(run)?.toLowerCase().includes(q) ?? false),
    )
  }, [billingRuns, filter, query, deployments])

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Deployment activity</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          All runs and API calls from your shared links and hosted APIs — including who was signed in.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search run id, deployment, caller…"
            className="h-8 pl-8 font-mono text-xs"
          />
        </div>
        <select
          value={filter ? `${filter.kind}:${filter.id}` : ""}
          onChange={(e) => {
            const v = e.target.value
            if (!v) {
              setFilter(null)
              return
            }
            const sep = v.indexOf(":")
            if (sep < 0) return
            setFilter({ kind: v.slice(0, sep) as "link" | "api", id: v.slice(sep + 1) })
          }}
          className="h-8 rounded-md border border-border bg-background px-2 font-mono text-xs"
        >
          <option value="">All deployments</option>
          {deployments.map((item) => (
            <option key={`${item.kind}-${item.row.id}`} value={`${item.kind}:${item.row.id}`}>
              {item.kind === "link" ? "Link" : "API"} · {item.row.name}
            </option>
          ))}
        </select>
      </div>

      <ScrollArea className="min-h-0 flex-1 rounded-lg border border-border">
        {deploymentRuns.length === 0 ? (
          <p className="px-4 py-16 text-center text-xs text-muted-foreground">
            No deployment runs logged yet — activity appears here after someone uses a link or API.
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 border-b border-border bg-muted/40 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Deployment</th>
                <th className="px-3 py-2 font-medium">Caller</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Cost</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deploymentRuns.map((run) => {
                const kind = deploymentRunKindLabel(run)
                return (
                  <tr key={run.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">
                      <div>{timeAgo(run.startedAt)}</div>
                      <div className="text-[9px] opacity-70">{run.id}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {kind === "link" ? (
                          <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <Zap className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate font-medium">{deploymentLabel(deployments, run)}</span>
                        <Badge variant="outline" className="shrink-0 font-mono text-[9px] uppercase">
                          {kind}
                        </Badge>
                      </div>
                    </td>
                    <td className="max-w-[180px] px-3 py-2.5">
                      <span
                        className={cn(
                          "block truncate font-mono text-[10px]",
                          run.triggerUserId || run.triggerUserEmail
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                        title={deploymentRunCallerLabel(run)}
                      >
                        {deploymentRunCallerLabel(run)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-[10px]",
                          run.status === "ok"
                            ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                            : "border-destructive/40 text-destructive",
                        )}
                      >
                        {run.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">
                      {formatSecondsShort(runTotalMs(run))}
                      <br />
                      {formatCostCents(runBilledCents(run))}
                    </td>
                    <td className="px-3 py-2.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 text-[10px]"
                        onClick={() => openLogging(run.id)}
                      >
                        <ScrollText className="h-3 w-3" />
                        Log
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </ScrollArea>
    </div>
  )
}
