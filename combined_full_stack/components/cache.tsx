"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useStore } from "@/lib/store"
import { WindowHeader } from "@/components/window-header"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/time-ago"
import { Database, Search, Zap } from "lucide-react"
import type { DocId, ModelId, ModuleId, ProjectId } from "@/lib/types"

type CacheEntryRow = {
  key: string
  projectId: ProjectId
  projectName?: string
  moduleId: ModuleId
  moduleLabel?: string
  model: ModelId
  inputDocIds: DocId[]
  hits: number
  costCents?: number
  lastHitAt?: number
  createdAt?: number
  inputPreview?: string
  sizeBytes: number
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function Cache() {
  const { project } = useStore()
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState<"project" | "all">("project")
  const [entries, setEntries] = useState<CacheEntryRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set("q", query.trim())
      if (scope === "project") params.set("projectId", project.id)
      const res = await fetch(`/api/cache?${params}`)
      if (!res.ok) throw new Error("cache fetch failed")
      const data = (await res.json()) as { entries: CacheEntryRow[] }
      setEntries(data.entries)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [query, scope, project.id])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(t)
  }, [load])

  const totals = useMemo(() => {
    const hits = entries.reduce((a, e) => a + e.hits, 0)
    const saved = entries.reduce((a, e) => a + (e.costCents ?? 0) * e.hits, 0)
    return { hits, saved, count: entries.length }
  }, [entries])

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="cache"
        title="Step cache"
        description="Disk-cached pipeline steps — search entries and see reuse counts."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 font-mono text-[10px]">
              <Database className="h-3 w-3" />
              {totals.count} entries
            </Badge>
            <Badge variant="secondary" className="gap-1 font-mono text-[10px]">
              <Zap className="h-3 w-3 text-primary" />
              {totals.hits} hits
            </Badge>
          </div>
        }
      />

      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search project, step, model, doc ids…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex shrink-0 rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setScope("project")}
            className={cn(
              "rounded px-2.5 py-1 font-mono text-[10px] transition-colors",
              scope === "project" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            this project
          </button>
          <button
            type="button"
            onClick={() => setScope("all")}
            className={cn(
              "rounded px-2.5 py-1 font-mono text-[10px] transition-colors",
              scope === "all" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            all projects
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <p className="px-4 py-8 text-center font-mono text-xs text-muted-foreground">loading cache…</p>
        ) : entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            No cached steps yet. Run inference with cache enabled — steps are cached on first execution.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((e) => (
              <div key={e.key} className="px-4 py-3 hover:bg-secondary/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{e.moduleLabel ?? e.moduleId}</span>
                      {scope === "all" && e.projectName && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {e.projectName}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="gap-1 font-mono text-[10px]">
                        <Zap className="h-2.5 w-2.5 text-primary" />
                        {e.hits} {e.hits === 1 ? "hit" : "hits"}
                      </Badge>
                      {e.costCents != null && e.hits > 0 && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          ~{(e.costCents * e.hits).toFixed(2)}¢ saved
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {e.model}
                      {e.inputDocIds.length > 0 ? ` · ${e.inputDocIds.join(", ")}` : ""}
                    </p>
                    {e.inputPreview && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/90">{e.inputPreview}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                    <p>{formatBytes(e.sizeBytes)}</p>
                    {e.lastHitAt != null && <p className="mt-0.5">last hit {timeAgo(e.lastHitAt)}</p>}
                    {e.createdAt != null && !e.lastHitAt && <p className="mt-0.5">written {timeAgo(e.createdAt)}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
