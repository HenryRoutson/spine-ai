"use client"

import { useState } from "react"
import { useStore } from "@/lib/store"
import { WindowHeader } from "@/components/window-header"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { JsonHighlight } from "@/components/highlight"
import { cn } from "@/lib/utils"
import { Search, ChevronRight, Database, Cpu, Code2, Combine, FileCog, Zap } from "lucide-react"
import type { ModuleKind } from "@/lib/types"

const KIND_ICON: Record<ModuleKind, typeof Cpu> = {
  input: Database,
  "doc-to-text": FileCog,
  llm: Cpu,
  transform: Code2,
  combine: Combine,
  "custom-code": Code2,
  output: ChevronRight,
}

export function Logging() {
  const { runs, docs } = useStore()
  const [query, setQuery] = useState("")
  const [selectedRun, setSelectedRun] = useState<string | null>(null)

  const docName = (id?: string) => docs.find((d) => d.id === id)?.name ?? id ?? "—"

  const filtered = runs.filter((r) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      r.model.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.steps.some((s) => s.label.toLowerCase().includes(q))
    )
  })

  const active = runs.find((r) => r.id === selectedRun) ?? null

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="05 / Logging"
        title="Run History"
        description="Every inference run is recorded with a full per-step trace, token counts, and cost."
      />
      <div className="flex min-h-0 flex-1">
        {/* Run list */}
        <div className="flex w-[340px] flex-col border-r border-border">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by model, step, run id…"
                className="h-8 pl-8 font-mono text-xs"
              />
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            {filtered.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">
                No runs yet. Execute a pipeline from the Inference window.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((run) => (
                  <li key={run.id}>
                    <button
                      onClick={() => setSelectedRun(run.id)}
                      className={cn(
                        "flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-accent",
                        active?.id === run.id && "bg-accent",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-xs">{docName(run.inputDocId)}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 font-mono text-[10px]",
                            run.status === "ok"
                              ? "border-primary/40 text-primary"
                              : "border-destructive/40 text-destructive",
                          )}
                        >
                          {run.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                        <span>{run.model}</span>
                        <span>
                          {(run.totalMs / 1000).toFixed(1)}s · ${(run.billedCents / 100).toFixed(2)}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(run.startedAt).toLocaleTimeString()} · {run.id}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Detail */}
        <div className="min-w-0 flex-1">
          {!active ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-muted-foreground">Select a run to view its trace.</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Latency", value: `${(active.totalMs / 1000).toFixed(1)}s` },
                    { label: "Billed", value: `$${(active.billedCents / 100).toFixed(2)}` },
                    { label: "Saved (cache)", value: `$${(active.savedCents / 100).toFixed(2)}` },
                    {
                      label: "Cache hits",
                      value: `${active.steps.filter((s) => s.status === "cached").length}/${active.steps.length}`,
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-md border border-border bg-card p-2.5">
                      <p className="font-mono text-[10px] uppercase text-muted-foreground">{stat.label}</p>
                      <p className="mt-0.5 font-mono text-sm">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Step trace
                  </h3>
                  <ol className="space-y-1.5">
                    {active.steps.map((step, i) => {
                      const Icon = KIND_ICON[step.kind] ?? Cpu
                      return (
                        <li
                          key={step.moduleId}
                          className="rounded-md border border-border bg-card px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            <span className="flex-1 truncate font-mono text-xs">{step.label}</span>
                            {step.status === "cached" && (
                              <Badge
                                variant="outline"
                                className="gap-1 border-chart-3/40 font-mono text-[10px] text-chart-3"
                              >
                                <Zap className="h-2.5 w-2.5" /> cached
                              </Badge>
                            )}
                            {step.model && (
                              <span className="font-mono text-[10px] text-muted-foreground">{step.model}</span>
                            )}
                            <span className="w-14 text-right font-mono text-[10px] text-muted-foreground">
                              {step.ms}ms
                            </span>
                            <span className="w-16 text-right font-mono text-[10px] text-muted-foreground">
                              ${(step.costCents / 100).toFixed(4)}
                            </span>
                          </div>
                          <p className="mt-1 pl-7 font-mono text-[10px] text-muted-foreground">
                            {step.inputPreview} <ChevronRight className="inline h-3 w-3" /> {step.outputPreview}
                          </p>
                          {step.outputJson && (
                            <div className="mt-2 rounded border border-border bg-[oklch(0.14_0.004_264)] p-2">
                              <JsonHighlight json={step.outputJson} />
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  )
}
