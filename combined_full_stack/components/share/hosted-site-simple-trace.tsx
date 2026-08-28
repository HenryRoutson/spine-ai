"use client"

import { AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import type { StepUiState } from "@/lib/run-engine"
import type { ModuleId, PipelineModule } from "@/lib/types"
import { RunPhase } from "@/lib/run-phase"

function rowState(states: Map<ModuleId, StepUiState>, id: ModuleId | undefined): StepUiState["status"] | "idle" {
  if (!id) return "idle"
  return states.get(id)?.status ?? "idle"
}

function HostedArithRow({
  label,
  state,
}: {
  label: string
  state: StepUiState["status"] | "idle"
}) {
  const icon =
    state === "ok" || state === "cached" ? (
      <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--hs-accent)" }} />
    ) : state === "running" ? (
      <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-55" />
    ) : state === "error" ? (
      <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
    ) : (
      <Circle className="h-4 w-4 shrink-0 opacity-30" />
    )
  return (
    <div className="hs-arith-row">
      {icon}
      <span>{label}</span>
    </div>
  )
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
            <p className="text-sm opacity-60">Working…</p>
            <span className="text-sm tabular-nums opacity-60">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>
      ) : null}
      <div className="space-y-2">
        {rows.map((row) => (
          <HostedArithRow key={row.label} label={row.label} state={row.state} />
        ))}
      </div>
    </div>
  )
}
