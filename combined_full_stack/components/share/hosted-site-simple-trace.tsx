"use client"

import { InferenceStepRow } from "@/components/inference/inference-step-trace"
import { Progress } from "@/components/ui/progress"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import type { StepUiState } from "@/lib/run-engine"
import type { ModuleId, PipelineModule } from "@/lib/types"
import { RunPhase } from "@/lib/run-phase"

function rowState(states: Map<ModuleId, StepUiState>, id: ModuleId | undefined): StepUiState["status"] | "idle" {
  if (!id) return "idle"
  return states.get(id)?.status ?? "idle"
}

export function HostedSiteSimpleTrace({
  modules,
  stepStates,
  phase,
  labels,
}: {
  modules: PipelineModule[]
  stepStates: Map<ModuleId, StepUiState>
  phase: RunPhase
  labels: string[]
}) {
  if (phase !== RunPhase.Running && phase !== RunPhase.Done) return null
  // AI : hosted UI only lists the 1–2 arithmetic steps, not the full pipeline tree.
  const flat = flattenPipelineModules(modules)
  const rows = labels.map((label) => {
    const mod = flat.find((m) => m.label === label)
    return { label, state: rowState(stepStates, mod?.id) }
  })
  const done = rows.filter((row) => row.state !== "idle" && row.state !== "running").length
  const progressPct = phase === RunPhase.Done ? 100 : Math.round((done / Math.max(1, rows.length)) * 100)

  return (
    <div className="hs-step-trace mt-4 text-left" data-spine-id="site.sql-action-trace">
      {phase === RunPhase.Running ? (
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Working…</p>
            <span className="text-sm tabular-nums text-muted-foreground">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>
      ) : null}
      <div className="space-y-2">
        {rows.map((row) => (
          <InferenceStepRow key={row.label} label={row.label} state={row.state} />
        ))}
      </div>
    </div>
  )
}
