"use client"

import { useMemo } from "react"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { OpenInDocumentsLink } from "@/components/open-in-documents"
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import { runBilledCents, runTotalMs } from "@/lib/run-metrics"
import { isSharedRun } from "@/lib/shared-link-types"
import { timeAgo } from "@/lib/time-ago"
import { cn } from "@/lib/utils"
import { compactPreview, PREVIEW_RUN_NOTES_CHARS } from "@/lib/text-preview"
import { useStatusPalette } from "@/lib/chart-colors"
import { RunSource, type DocId, type PipelineRun } from "@/lib/types"

// AI : Testing-tab runs carry source "testing" — badge + searchable via "testing".
export function isTestingRun(run: PipelineRun): boolean {
  return run.source === RunSource.Testing
}

export function filterRuns(runs: PipelineRun[], query: string): PipelineRun[] {
  if (!query.trim()) return runs
  const q = query.toLowerCase()
  return runs.filter(
    (r) =>
      r.model.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.notes?.toLowerCase().includes(q) ?? false) ||
      (r.source?.toLowerCase().includes(q) ?? false) ||
      r.steps.some((s) => s.label.toLowerCase().includes(q)),
  )
}

export function RunNotesPreview({ notes }: { notes: string }) {
  return (
    <p className="truncate text-[10px] text-muted-foreground/90" title={notes}>
      {compactPreview(notes, PREVIEW_RUN_NOTES_CHARS)}
    </p>
  )
}

export function RunPickerColumn({
  label,
  runs,
  runInputLabel,
  runInputDocIds,
  selectedId,
  onSelect,
  query,
  onQueryChange,
}: {
  label: string
  runs: PipelineRun[]
  runInputLabel: (run: PipelineRun) => string
  runInputDocIds: (run: PipelineRun) => DocId[]
  selectedId: string
  onSelect: (id: string) => void
  query: string
  onQueryChange: (q: string) => void
}) {
  const filtered = useMemo(() => filterRuns(runs, query), [runs, query])
  const palette = useStatusPalette()

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="border-b border-border px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Filter by model, step, run id…"
            className="h-8 pl-8 font-mono text-xs"
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {filtered.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No matching runs.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((run) => (
              <li key={run.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(run.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSelect(run.id)
                    }
                  }}
                  className={cn(
                    "flex w-full cursor-pointer flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-accent",
                    selectedId === run.id && "bg-accent",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs">{runInputLabel(run)}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {isSharedRun(run) && (
                        <Badge variant="secondary" className="shrink-0 font-mono text-[9px]">
                          shared run
                        </Badge>
                      )}
                      {isTestingRun(run) && (
                        <Badge variant="outline" className="shrink-0 border-chart-3/40 font-mono text-[9px] text-chart-3">
                          test
                        </Badge>
                      )}
                      {runInputDocIds(run).map((docId) => (
                        <OpenInDocumentsLink key={docId} docId={docId} label="store" className="text-[9px]" />
                      ))}
                      <Badge
                        variant="outline"
                        className="shrink-0 font-mono text-[10px]"
                        style={run.status === "ok"
                          ? { color: palette.ok, borderColor: `${palette.ok}66` }
                          : { color: palette.err, borderColor: `${palette.err}66` }}
                      >
                        {run.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span>{run.model}</span>
                    <span>
                      {formatSecondsShort(runTotalMs(run))} · {formatCostCents(runBilledCents(run))}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(run.startedAt).toLocaleString()} · {timeAgo(run.startedAt)} · {run.id}
                  </span>
                  {run.notes && <RunNotesPreview notes={run.notes} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}
