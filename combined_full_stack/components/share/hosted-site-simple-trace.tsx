"use client"

import { AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { hostedPipelineTraceRows, type hosted_pipeline_step } from "@/lib/hosted-pipeline-trace"
import type { StepUiState } from "@/lib/run-engine"
import type { ModuleId } from "@/lib/types"
import { RunPhase } from "@/lib/run-phase"

function HostedArithRow({
  step,
  state,
}: {
  step: hosted_pipeline_step
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
    <div className="hs-arith-row" data-hs-module-id={step.moduleId} data-hs-sql={step.expr}>
      {icon}
      <span className="hs-arith-copy">
        <span className="hs-arith-label">{step.label}</span>
        <span className="hs-arith-sql">{step.expr}</span>
      </span>
      <span className="hs-arith-eq">
        {step.from} → {step.to}
      </span>
    </div>
  )
}

export function HostedSiteSimpleTrace({
  planned,
  stepStates,
  phase,
}: {
  planned: hosted_pipeline_step[]
  stepStates: Map<ModuleId, StepUiState>
  phase: RunPhase
}) {
  if (phase !== RunPhase.Running && phase !== RunPhase.Done) return null
  const rows = hostedPipelineTraceRows(planned, stepStates)
  if (rows.length === 0) return null
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
          <HostedArithRow key={row.moduleId} step={row} state={row.state} />
        ))}
      </div>
    </div>
  )
}
