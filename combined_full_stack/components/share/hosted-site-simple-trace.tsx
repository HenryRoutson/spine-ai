"use client"

import { InferenceStepRow } from "@/components/inference/inference-step-trace"
import { CyclingWaitPhrase } from "@/components/inference/inference-run-chrome"
import { Progress } from "@/components/ui/progress"
import { flattenPipelineModules, forkBranchesOf, isNestedLaneKind } from "@/lib/fork-pipeline"
import type { StepUiState } from "@/lib/run-engine"
import type { ModuleId, PipelineModule } from "@/lib/types"
import { RunPhase } from "@/lib/run-phase"

function rowState(states: Map<ModuleId, StepUiState>, id: ModuleId): StepUiState["status"] | "idle" {
  return states.get(id)?.status ?? "idle"
}

function HostedSiteTraceSteps({
  modules,
  stepStates,
  nested = false,
}: {
  modules: PipelineModule[]
  stepStates: Map<ModuleId, StepUiState>
  nested?: boolean
}) {
  return (
    <div className={nested ? "space-y-1.5 border-l border-border/70 pl-3" : "space-y-2"}>
      {modules.map((m) => {
        const branches = isNestedLaneKind(m.kind) ? forkBranchesOf(m) : []
        return (
          <div key={m.id} className="space-y-1.5">
            <InferenceStepRow label={m.label} state={rowState(stepStates, m.id)} nested={nested} />
            {branches.map((branch) => (
              <div key={branch.id} className="space-y-1">
                <p className="pl-7 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {branch.label}
                </p>
                <HostedSiteTraceSteps modules={branch.modules} stepStates={stepStates} nested />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export function HostedSiteSimpleTrace({
  modules,
  stepStates,
  phase,
  waitPhrase,
}: {
  modules: PipelineModule[]
  stepStates: Map<ModuleId, StepUiState>
  phase: RunPhase
  waitPhrase: string
}) {
  if (phase !== RunPhase.Running && phase !== RunPhase.Done) return null
  const flat = flattenPipelineModules(modules)
  const done = flat.filter((m) => {
    const s = stepStates.get(m.id)?.status
    return s !== undefined && s !== "idle" && s !== "running"
  }).length
  const progressPct =
    phase === RunPhase.Done ? 100 : Math.round((done / Math.max(1, flat.length)) * 100)

  return (
    <div className="hs-step-trace mt-4 text-left" data-spine-id="site.sql-action-trace">
      {phase === RunPhase.Running ? (
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Working…</p>
            <span className="text-sm tabular-nums text-muted-foreground">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
          <CyclingWaitPhrase phrase={waitPhrase} />
        </div>
      ) : null}
      <HostedSiteTraceSteps modules={modules} stepStates={stepStates} />
    </div>
  )
}
