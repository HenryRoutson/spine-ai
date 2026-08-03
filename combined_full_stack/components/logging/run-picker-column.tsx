"use client"

import { useMemo } from "react"
import { Search } from "lucide-react"
import { EntityRail, EntityRailItem, EntityRailSection } from "@/components/entity-rail"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { OpenInDocumentsLink } from "@/components/open-in-documents"
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import { runBilledCents, runTotalMs } from "@/lib/run-metrics"
import { isSharedRun } from "@/lib/shared-link-types"
import { deploymentRunCallerLabel, isHostedApiRun } from "@/lib/deployment-runs"
import { timeAgo } from "@/lib/time-ago"
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
      (r.sharedLinkId?.toLowerCase().includes(q) ?? false) ||
      (r.hostedApiId?.toLowerCase().includes(q) ?? false) ||
      (r.triggerUserEmail?.toLowerCase().includes(q) ?? false) ||
      (r.triggerUserId?.toLowerCase().includes(q) ?? false) ||
      (r.viewerName?.toLowerCase().includes(q) ?? false) ||
      (r.viewerSessionId?.toLowerCase().includes(q) ?? false) ||
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
    <EntityRail className="min-h-0 min-w-0 flex-1">
      <EntityRailSection title={label} className="min-h-0 flex-1">
        <div className="mb-2">
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
        {filtered.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">No matching runs.</p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((run) => (
              <li key={run.id}>
                <EntityRailItem active={selectedId === run.id} onClick={() => onSelect(run.id)}>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs text-foreground">{runInputLabel(run)}</span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isSharedRun(run) && (
                          <Badge variant="secondary" className="shrink-0 font-mono text-[9px]">
                            shared run
                          </Badge>
                        )}
                        {isHostedApiRun(run) && (
                          <Badge variant="secondary" className="shrink-0 font-mono text-[9px]">
                            api call
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
                    {(isSharedRun(run) || isHostedApiRun(run)) && (
                      <span className="font-mono text-[10px] text-muted-foreground/90">
                        {deploymentRunCallerLabel(run)}
                      </span>
                    )}
                    {run.notes && <RunNotesPreview notes={run.notes} />}
                  </div>
                </EntityRailItem>
              </li>
            ))}
          </ul>
        )}
      </EntityRailSection>
    </EntityRail>
  )
}
