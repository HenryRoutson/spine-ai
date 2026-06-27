"use client"

import type { RefObject } from "react"
import { Progress } from "@/components/ui/progress"
import { segmentPipeline, mergeCombineSegmentStatus } from "@/lib/pipeline-layout"
import type { StepUiState } from "@/lib/run-engine"
import type { JobLogEntry, ModuleId, PipelineModule, PipelineRun } from "@/lib/types"
import {
  InferenceStepRow,
  stepDescriptionMeta,
} from "@/components/inference/inference-step-trace"
import { moduleInputDescription } from "@/components/step-input-description"
import { CyclingWaitPhrase } from "@/components/inference/inference-run-chrome"

export function InferenceStepTracePanel({
  modules,
  phase,
  stepStates,
  run,
  progressPct,
  waitPhrase,
  logsByModule,
  logEndRef,
  footer,
}: {
  modules: PipelineModule[]
  phase: "idle" | "running" | "done"
  stepStates: Map<ModuleId, StepUiState>
  run: PipelineRun | null
  progressPct: number
  waitPhrase: string
  logsByModule?: Map<ModuleId, JobLogEntry[]>
  logEndRef?: RefObject<HTMLDivElement | null>
  footer?: React.ReactNode
}) {
  if (phase !== "running" && phase !== "done") return null

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {phase === "done" ? "step trace" : "progress"}
        </span>
        <span className="font-mono text-[11px] text-primary">{progressPct}%</span>
      </div>
      <Progress value={progressPct} className="h-1.5" />
      {phase === "running" && <CyclingWaitPhrase phrase={waitPhrase} className="mt-3" />}
      {footer}
      <div className="mt-4 space-y-2.5">
        {segmentPipeline(modules).map((seg) => {
          if (seg.kind === "combine") {
            const combineUi = stepStates.get(seg.combine.id)
            const inputUi = stepStates.get(seg.input.id)
            const inputState = inputUi?.status ?? "idle"
            const state = mergeCombineSegmentStatus(combineUi?.status ?? "idle", inputState)
            const combineDesc = stepDescriptionMeta(seg.combine.id, run, combineUi)
            const inputDesc = stepDescriptionMeta(seg.input.id, run, inputUi)
            return (
              <div key={seg.combine.id} className="space-y-1">
                <InferenceStepRow
                  label={seg.combine.label}
                  state={state}
                  sub={combineUi?.sub}
                  inputDescription={moduleInputDescription(seg.combine)}
                  inputDescriptionCheck={combineDesc.check}
                  descriptionCheckLlmCalls={combineDesc.descriptionCheckLlmCalls}
                  descriptionCheckCostCents={combineDesc.descriptionCheckCostCents}
                  serverLogs={logsByModule?.get(seg.combine.id) ?? []}
                />
                <InferenceStepRow
                  label={seg.input.label}
                  state={inputState}
                  sub={inputUi?.sub}
                  nested
                  inputDescription={moduleInputDescription(seg.input)}
                  inputDescriptionCheck={inputDesc.check}
                  descriptionCheckLlmCalls={inputDesc.descriptionCheckLlmCalls}
                  descriptionCheckCostCents={inputDesc.descriptionCheckCostCents}
                  serverLogs={logsByModule?.get(seg.input.id) ?? []}
                />
              </div>
            )
          }
          const moduleUi = stepStates.get(seg.module.id)
          const moduleDesc = stepDescriptionMeta(seg.module.id, run, moduleUi)
          return (
            <InferenceStepRow
              key={seg.module.id}
              label={seg.module.label}
              state={moduleUi?.status ?? "idle"}
              sub={moduleUi?.sub}
              isOutputStep={seg.module.kind === "output"}
              inputDescription={moduleInputDescription(seg.module)}
              inputDescriptionCheck={moduleDesc.check}
              descriptionCheckLlmCalls={moduleDesc.descriptionCheckLlmCalls}
              descriptionCheckCostCents={moduleDesc.descriptionCheckCostCents}
              serverLogs={logsByModule?.get(seg.module.id) ?? []}
            />
          )
        })}
      </div>
      {logEndRef ? <div ref={logEndRef} /> : null}
    </div>
  )
}
