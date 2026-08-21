"use client"

import { SimpleStepTrace, simpleTraceStepsFromRun } from "@/components/simple-step-trace"
import { formatCostCents } from "@/lib/format"
import { formatRunErrorForDisplay } from "@/lib/run-errors"
import { isSlimPipelineRun, runBilledCents } from "@/lib/run-metrics"
import { timeAgo } from "@/lib/time-ago"
import { uiContextTargetProps } from "@/lib/ui-context-dom"
import type { PipelineModule, PipelineRun, StructureModel } from "@/lib/types"

function runStatusLabel(status: PipelineRun["status"]): string {
  return status === "error" ? "Failed" : "Done"
}

export function SimpleLoggingTrace({
  run,
  modules,
  models,
}: {
  run: PipelineRun
  modules: PipelineModule[]
  models: StructureModel[]
}) {
  const runError = formatRunErrorForDisplay(run)
  const billed = runBilledCents(run)
  const failed = run.status === "error"

  return (
    <div
      className="space-y-4 p-4"
      {...uiContextTargetProps({
        kind: failed ? "run_error" : "generic",
        id: `run:${run.id}`,
        label: `Run · ${runStatusLabel(run.status)}`,
        snippet: failed ? runError?.message : undefined,
      })}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {runStatusLabel(run.status)}
          <span className="font-normal text-muted-foreground"> · {timeAgo(run.startedAt)}</span>
          {billed > 0 ? (
            <span className="font-normal text-muted-foreground"> · {formatCostCents(billed)}</span>
          ) : null}
        </p>
        {failed && runError ? (
          <p className="text-sm text-destructive">{runError.message}</p>
        ) : null}
      </div>
      <SimpleStepTrace
        steps={simpleTraceStepsFromRun(run, modules)}
        models={models}
        loading={isSlimPipelineRun(run)}
      />
    </div>
  )
}
