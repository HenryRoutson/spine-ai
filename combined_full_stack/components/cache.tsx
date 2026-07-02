"use client"

// AI : TODO — IoPager for inputPreviewItems (same as logging.tsx); cache detail still dumps flat inputPreview.
import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useStore } from "@/lib/store"
import { WindowHeader } from "@/components/window-header"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { PromptText } from "@/components/highlight"
import { QuoteLinks, quotesFromJson } from "@/components/quote-links"
import { IoPager } from "@/components/logging/io-pager"
import { API_ROUTES } from "@/lib/api-routes"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/time-ago"
import { compactPreview, PREVIEW_STEP_IO_CHARS } from "@/lib/text-preview"
import { Database, Maximize2, Search, X, Zap } from "lucide-react"
import type { DocId, InputPreviewItem, ModelId, ModuleId, ProjectId } from "@/lib/types"

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

type CacheEntryDetail = CacheEntryRow & {
  outputJson: string
  docId?: DocId
  inputPreviewItems?: InputPreviewItem[]
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

type CacheSearchFields = {
  step: boolean
  input: boolean
  output: boolean
}

function SearchFieldToggle({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-2.5 py-1 font-mono text-[10px] transition-colors",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  )
}

export function Cache() {
  const { project } = useStore()
  const [query, setQuery] = useState("")
  const [searchFields, setSearchFields] = useState<CacheSearchFields>({
    step: true,
    input: false,
    output: false,
  })
  const [scope, setScope] = useState<"project" | "all">("project")
  const [entries, setEntries] = useState<CacheEntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<CacheEntryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set("q", query.trim())
      if (searchFields.step) params.set("searchStep", "1")
      if (searchFields.input) params.set("searchInput", "1")
      if (searchFields.output) params.set("searchOutput", "1")
      if (scope === "project") params.set("projectId", project.id)
      const res = await fetch(`${API_ROUTES.cache}?${params}`)
      if (!res.ok) throw new Error("cache fetch failed")
      const data = (await res.json()) as { entries: CacheEntryRow[] }
      setEntries(data.entries)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [query, searchFields, scope, project.id])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(t)
  }, [load])

  const openDetail = useCallback(async (key: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(API_ROUTES.cacheEntry(key))
      if (!res.ok) throw new Error("cache detail fetch failed")
      const data = (await res.json()) as { entry: CacheEntryDetail }
      setDetail(data.entry)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const totals = useMemo(() => {
    const hits = entries.reduce((a, e) => a + e.hits, 0)
    const saved = entries.reduce((a, e) => a + (e.costCents ?? 0) * e.hits, 0)
    return { hits, saved, count: entries.length }
  }, [entries])

  const detailQuotes = detail?.outputJson ? quotesFromJson(detail.outputJson) : []

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

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex shrink-0 rounded-md border border-border p-0.5">
          <SearchFieldToggle
            label="step"
            active={searchFields.step}
            onClick={() => setSearchFields((f) => ({ ...f, step: !f.step }))}
          />
          <SearchFieldToggle
            label="input"
            active={searchFields.input}
            onClick={() => setSearchFields((f) => ({ ...f, input: !f.input }))}
          />
          <SearchFieldToggle
            label="output"
            active={searchFields.output}
            onClick={() => setSearchFields((f) => ({ ...f, output: !f.output }))}
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
              <div
                key={e.key}
                role="button"
                tabIndex={0}
                onClick={() => void openDetail(e.key)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault()
                    void openDetail(e.key)
                  }
                }}
                className="cursor-pointer px-4 py-3 hover:bg-secondary/30"
              >
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
                      <p className="mt-1 text-[11px] text-muted-foreground/90">
                        {compactPreview(e.inputPreview, PREVIEW_STEP_IO_CHARS)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        void openDetail(e.key)
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Open full cache entry"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="text-right font-mono text-[10px] text-muted-foreground">
                      <p>{formatBytes(e.sizeBytes)}</p>
                      {e.lastHitAt != null && <p className="mt-0.5">last hit {timeAgo(e.lastHitAt)}</p>}
                      {e.createdAt != null && !e.lastHitAt && <p className="mt-0.5">written {timeAgo(e.createdAt)}</p>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {(detail || detailLoading) &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col">
            <button
              aria-label="Close viewer"
              className="absolute inset-0 bg-background/70 backdrop-blur-sm"
              onClick={() => setDetail(null)}
            />
            <div className="relative m-6 flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="font-mono text-xs text-muted-foreground">
                  {detail
                    ? `${detail.moduleLabel ?? detail.moduleId} · ${detail.model}`
                    : "loading cache entry…"}
                </span>
                <button
                  onClick={() => setDetail(null)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {detailLoading && !detail ? (
                <p className="p-6 font-mono text-xs text-muted-foreground">loading…</p>
              ) : detail ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
                    {detail.projectName && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {detail.projectName}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="gap-1 font-mono text-[10px]">
                      <Zap className="h-2.5 w-2.5 text-primary" />
                      {detail.hits} hits
                    </Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">{formatBytes(detail.sizeBytes)}</span>
                    {detail.inputDocIds.length > 0 && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {detail.inputDocIds.join(", ")}
                      </span>
                    )}
                  </div>
                  <ScrollArea className="min-h-0 flex-1">
                    <div className="space-y-4 p-4">
                      {detail.inputPreview && (
                        <section>
                          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                            Input
                          </h3>
                          {detail.inputPreviewItems && detail.inputPreviewItems.length > 1 ? (
                            <IoPager
                              items={detail.inputPreviewItems}
                              renderItem={(item) => (
                                <div className="rounded border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                                  <PromptText text={item.text} />
                                </div>
                              )}
                            />
                          ) : (
                            <div className="rounded border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                              <PromptText text={detail.inputPreview} />
                            </div>
                          )}
                        </section>
                      )}
                      <section>
                        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          Output
                        </h3>
                        {detailQuotes.length > 0 && <QuoteLinks quotes={detailQuotes} className="mb-2" />}
                        <JsonPreviewPanel json={detail.outputJson} className="min-h-[12rem]" />
                      </section>
                    </div>
                  </ScrollArea>
                </div>
              ) : null}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
