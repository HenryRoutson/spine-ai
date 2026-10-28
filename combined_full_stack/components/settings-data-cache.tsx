"use client"

import { useSyncExternalStore } from "react"
import { useOptionalStore } from "@/lib/store"
import {
  formatDataBytes,
  getProjectStateCacheRevision,
  getProjectStateCacheStats,
  getProjectStateCacheTotalBytes,
  readBillingRunsCache,
  subscribeProjectStateCache,
} from "@/lib/project-state-cache"
import { subscribeBackgroundPrefetch, getBackgroundPrefetchProgress } from "@/lib/background-project-prefetch"

function useCacheRevision(): number {
  const cacheRev = useSyncExternalStore(
    subscribeProjectStateCache,
    getProjectStateCacheRevision,
    () => 0,
  )
  const prefetchRev = useSyncExternalStore(
    subscribeBackgroundPrefetch,
    () => getBackgroundPrefetchProgress().done,
    () => 0,
  )
  return cacheRev + prefetchRev
}

// AI : show how much /api/state JSON is held in memory — helps explain prefetch cost.
export function SettingsDataCache() {
  const builder = useOptionalStore()
  const tick = useCacheRevision()
  void tick

  const stats = getProjectStateCacheStats()
  const totalBytes = getProjectStateCacheTotalBytes()
  const billingRunCount = readBillingRunsCache()?.length ?? 0
  const projectCount = builder?.projects.length ?? 0
  const namesById = new Map<string, string>((builder?.projects ?? []).map((p) => [String(p.id), p.name]))
  const sorted = [...stats].sort((a, b) => b.bytes - a.bytes)
  const { active: warming } = getBackgroundPrefetchProgress()

  return (
    <section id="settings-data-cache" className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Project data cache</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Account data and per-project runs kept in memory for instant switches. Billing runs load separately.
          {warming ? " Other projects are still warming in the background." : null}
        </p>
      </div>
      <div className="space-y-3 px-4 py-3">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Cached</dt>
            <dd className="font-mono text-sm">{sorted.length}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Total projects</dt>
            <dd className="font-mono text-sm">{projectCount}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Memory (est.)</dt>
            <dd className="font-mono text-sm">{formatDataBytes(totalBytes)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg / project</dt>
            <dd className="font-mono text-sm">
              {sorted.length ? formatDataBytes(Math.round(totalBytes / sorted.length)) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Billing runs</dt>
            <dd className="font-mono text-sm">{billingRunCount || "—"}</dd>
          </div>
        </dl>
        {sorted.length ? (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[320px] text-left text-xs">
              <thead className="border-b border-border bg-muted/30 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 font-medium">Size</th>
                  <th className="px-3 py-2 font-medium">Docs</th>
                  <th className="px-3 py-2 font-medium">Runs</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.projectId} className="border-b border-border/60 last:border-0">
                    <td className="max-w-[12rem] truncate px-3 py-2 font-medium">
                      {namesById.get(row.projectId) ?? row.projectId.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{formatDataBytes(row.bytes)}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{row.docCount}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{row.runCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No project state cached yet.</p>
        )}
      </div>
    </section>
  )
}
