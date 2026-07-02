"use client"

import { useEffect, useState } from "react"
import type { RefObject } from "react"
import { ChevronDown, Copy, Check } from "lucide-react"
import { runLogText } from "@/lib/run-log-text"
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
import { docsForInputModule } from "@/lib/inference-input"
import { cn } from "@/lib/utils"
import type { DocRef, StructureModel } from "@/lib/types"

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
  docs,
  models,
  inputDocs,
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
  docs: DocRef[]
  models: StructureModel[]
  inputDocs: Partial<Record<ModuleId, DocRef | DocRef[]>>
}) {
  const [stepsExpanded, setStepsExpanded] = useState(true)
  const [logCopied, setLogCopied] = useState(false)
  // AI : show input/output viz while running and again after done when trace is expanded.
  const showStepIo = stepsExpanded && (phase === "running" || phase === "done")
  const ioCompact = phase === "running"

  useEffect(() => {
    if (phase === "running" || phase === "done") setStepsExpanded(true)
  }, [phase])

  if (phase !== "running" && phase !== "done") return null

  const collapseLogs = phase === "done"

  return (
    <div className="rounded-lg border border-border p-4">
      <div className={cn("flex items-center justify-between", stepsExpanded && "mb-2")}>
        <button
          type="button"
          onClick={() => setStepsExpanded((v) => !v)}
          className="inline-flex min-w-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={cn("h-3 w-3 shrink-0 transition-transform", stepsExpanded && "rotate-180")}
          />
          {phase === "done" ? "step trace" : "progress"}
        </button>
        <div className="flex items-center gap-2">
          {phase === "done" && run && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(runLogText(run))
                setLogCopied(true)
                setTimeout(() => setLogCopied(false), 2000)
              }}
              className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
            >
              {logCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {logCopied ? "copied" : "copy_log"}
            </button>
          )}
          <span className="font-mono text-[11px] text-primary">{progressPct}%</span>
        </div>
      </div>
      {stepsExpanded && <Progress value={progressPct} className="h-1.5" />}
      {stepsExpanded && phase === "running" && <CyclingWaitPhrase phrase={waitPhrase} className="mt-3" />}
      {stepsExpanded && footer}
      {stepsExpanded && (
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
                  showStepIo={showStepIo}
                  ioCompact={ioCompact}
                  outputPreview={combineUi?.outputPreview}
                  runStep={run?.steps.find((s) => s.moduleId === seg.combine.id)}
                  inputDescription={moduleInputDescription(seg.combine)}
                  inputDescriptionCheck={combineDesc.check}
                  descriptionCheckLlmCalls={combineDesc.descriptionCheckLlmCalls}
                  descriptionCheckCostCents={combineDesc.descriptionCheckCostCents}
                  serverLogs={logsByModule?.get(seg.combine.id) ?? []}
                  forceCollapsedLogs={collapseLogs}
                />
                <InferenceStepRow
                  label={seg.input.label}
                  state={inputState}
                  sub={inputUi?.sub}
                  nested
                  isInputStep
                  showStepIo={showStepIo}
                  ioCompact={ioCompact}
                  outputPreview={inputUi?.outputPreview}
                  runStep={run?.steps.find((s) => s.moduleId === seg.input.id)}
                  assignedInputDocs={docsForInputModule(inputDocs, seg.input.id)}
                  docs={docs}
                  models={models}
                  inputDescription={moduleInputDescription(seg.input)}
                  inputDescriptionCheck={inputDesc.check}
                  descriptionCheckLlmCalls={inputDesc.descriptionCheckLlmCalls}
                  descriptionCheckCostCents={inputDesc.descriptionCheckCostCents}
                  serverLogs={logsByModule?.get(seg.input.id) ?? []}
                  forceCollapsedLogs={collapseLogs}
                />
              </div>
            )
          }
          const moduleUi = stepStates.get(seg.module.id)
          const moduleDesc = stepDescriptionMeta(seg.module.id, run, moduleUi)
          const isInputStep = seg.module.kind === "input"
          return (
            <InferenceStepRow
              key={seg.module.id}
              label={seg.module.label}
              state={moduleUi?.status ?? "idle"}
              sub={moduleUi?.sub}
              isOutputStep={seg.module.kind === "output"}
              isInputStep={isInputStep}
              showStepIo={showStepIo}
              ioCompact={ioCompact}
              outputPreview={moduleUi?.outputPreview}
              runStep={run?.steps.find((s) => s.moduleId === seg.module.id)}
              assignedInputDocs={isInputStep ? docsForInputModule(inputDocs, seg.module.id) : []}
              docs={docs}
              models={models}
              inputDescription={moduleInputDescription(seg.module)}
              inputDescriptionCheck={moduleDesc.check}
              descriptionCheckLlmCalls={moduleDesc.descriptionCheckLlmCalls}
              descriptionCheckCostCents={moduleDesc.descriptionCheckCostCents}
              serverLogs={logsByModule?.get(seg.module.id) ?? []}
              forceCollapsedLogs={collapseLogs}
            />
          )
        })}
      </div>
      )}
      {stepsExpanded && logEndRef ? <div ref={logEndRef} /> : null}
    </div>
  )
}
