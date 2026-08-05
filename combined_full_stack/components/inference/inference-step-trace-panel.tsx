"use client"

import { useEffect, useState } from "react"
import type { ReactNode, RefObject } from "react"
import { ChevronDown, Copy, Check } from "lucide-react"
import { runErrorLogText, runHasErrors } from "@/lib/run-error-log"
import { DiagnosisRunLink } from "@/components/diagnosis-agents/diagnosis-run-link"
import { runLogText } from "@/lib/run-log-text"
import { runLogJson } from "@/lib/run-log-json"
import { copyTextToClipboard } from "@/lib/clipboard"
import { Progress } from "@/components/ui/progress"
import { segmentPipeline, mergeCombineSegmentStatus } from "@/lib/pipeline-layout"
import type { StepUiState } from "@/lib/run-engine"
import type { DocRef, JobLogEntry, ModuleId, PipelineModule, PipelineRun, StructureModel } from "@/lib/types"
import {
  InferenceStepRow,
  stepDescriptionMeta,
} from "@/components/inference/inference-step-trace"
import { moduleInputDescription } from "@/components/step-input-description"
import { CyclingWaitPhrase } from "@/components/inference/inference-run-chrome"
import { docsForInputModule } from "@/lib/inference-input"
import { cn } from "@/lib/utils"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import type { CodeExecUiState } from "@/lib/code-exec-ui"

type StepTracePanelCtx = {
  run: PipelineRun | null
  showStepIo: boolean
  ioCompact: boolean
  collapseLogs: boolean
  logsByModule?: Map<ModuleId, JobLogEntry[]>
  codeExecByModule?: Map<ModuleId, CodeExecUiState>
  docs: DocRef[]
  models: StructureModel[]
  inputDocs: Partial<Record<ModuleId, DocRef | DocRef[]>>
}

function bindInferenceStepRow(
  module: PipelineModule,
  stepUi: StepUiState | undefined,
  ctx: StepTracePanelCtx,
  opts?: { nested?: boolean; isInputStep?: boolean; isOutputStep?: boolean },
) {
  const desc = stepDescriptionMeta(module.id, ctx.run, stepUi)
  const isInputStep = opts?.isInputStep ?? module.kind === "input"
  return {
    label: module.label,
    state: stepUi?.status ?? ("idle" as const),
    sub: stepUi?.sub,
    nested: opts?.nested,
    isInputStep: opts?.isInputStep,
    isOutputStep: opts?.isOutputStep ?? module.kind === "output",
    module,
    codeExec: ctx.codeExecByModule?.get(module.id),
    showStepIo: ctx.showStepIo,
    ioCompact: ctx.ioCompact,
    outputPreview: stepUi?.outputPreview,
    runStep: ctx.run?.steps.find((s) => s.moduleId === module.id),
    runId: ctx.run?.id,
    assignedInputDocs: isInputStep ? docsForInputModule(ctx.inputDocs, module.id) : [],
    docs: ctx.docs,
    models: ctx.models,
    inputDescription: moduleInputDescription(module),
    inputDescriptionCheck: desc.check,
    descriptionCheckLlmCalls: desc.descriptionCheckLlmCalls,
    descriptionCheckCostCents: desc.descriptionCheckCostCents,
    serverLogs: ctx.logsByModule?.get(module.id) ?? [],
    forceCollapsedLogs: ctx.collapseLogs,
  }
}

function CopyTraceButton({
  label,
  copied,
  onCopy,
  tone = "muted",
}: {
  label: string
  copied: boolean
  onCopy: () => void | Promise<void>
  tone?: "muted" | "destructive"
}) {
  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10px]",
        tone === "destructive"
          ? "text-destructive hover:text-destructive/80"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "copied" : label}
    </button>
  )
}

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
  codeExecByModule,
}: {
  modules: PipelineModule[]
  phase: "idle" | "running" | "done"
  stepStates: Map<ModuleId, StepUiState>
  run: PipelineRun | null
  progressPct: number
  waitPhrase: string
  logsByModule?: Map<ModuleId, JobLogEntry[]>
  logEndRef?: RefObject<HTMLDivElement | null>
  footer?: ReactNode
  docs: DocRef[]
  models: StructureModel[]
  inputDocs: Partial<Record<ModuleId, DocRef | DocRef[]>>
  codeExecByModule?: Map<ModuleId, CodeExecUiState>
}) {
  const [stepsExpanded, setStepsExpanded] = useState(true)
  const [copiedKey, setCopiedKey] = useState<"errors" | "json" | "log" | null>(null)
  // AI : show input/output viz while running and again after done when trace is expanded.
  const showStepIo = stepsExpanded && (phase === "running" || phase === "done")
  const ioCompact = phase === "running"

  // AI : TODO (spec) — on phase done, auto-collapse non-output steps; keep output rows expanded.
  // AI : InferenceCollapsibleSection.collapseOnDone exists but is unused; wire it or default stepsExpanded false after done.
  useEffect(() => {
    if (phase === "running" || phase === "done") setStepsExpanded(true)
  }, [phase])

  if (phase !== "running" && phase !== "done") return null

  const collapseLogs = phase === "done"
  const stepCtx: StepTracePanelCtx = {
    run,
    showStepIo,
    ioCompact,
    collapseLogs,
    logsByModule,
    codeExecByModule,
    docs,
    models,
    inputDocs,
  }

  function markCopied(key: typeof copiedKey) {
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), COPY_FEEDBACK_MS)
  }

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
            <>
              {runHasErrors(run) && <DiagnosisRunLink runId={run.id} />}
              {runHasErrors(run) && (
                <CopyTraceButton
                  label="copy_errors"
                  copied={copiedKey === "errors"}
                  tone="destructive"
                  onCopy={async () => {
                    await copyTextToClipboard(runErrorLogText(run))
                    markCopied("errors")
                  }}
                />
              )}
              <CopyTraceButton
                label="copy_json"
                copied={copiedKey === "json"}
                onCopy={async () => {
                  await copyTextToClipboard(await runLogJson(run, docs))
                  markCopied("json")
                }}
              />
              <CopyTraceButton
                label="copy_log"
                copied={copiedKey === "log"}
                onCopy={async () => {
                  await copyTextToClipboard(runLogText(run))
                  markCopied("log")
                }}
              />
            </>
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
            const parseUi = seg.parse ? stepStates.get(seg.parse.id) : undefined
            const inputState = inputUi?.status ?? "idle"
            const parseState = parseUi?.status ?? "idle"
            const sideState = seg.parse ? mergeCombineSegmentStatus(parseState, inputState) : inputState
            const state = mergeCombineSegmentStatus(combineUi?.status ?? "idle", sideState)
            return (
              <div key={seg.combine.id} className="space-y-1">
                <InferenceStepRow
                  {...bindInferenceStepRow(seg.combine, combineUi, stepCtx)}
                  state={state}
                />
                <InferenceStepRow
                  {...bindInferenceStepRow(seg.input, inputUi, stepCtx, { nested: true, isInputStep: true })}
                />
                {seg.parse && (
                  <InferenceStepRow
                    {...bindInferenceStepRow(seg.parse, parseUi, stepCtx, { nested: true })}
                  />
                )}
              </div>
            )
          }
          return (
            <InferenceStepRow
              key={seg.module.id}
              {...bindInferenceStepRow(seg.module, stepStates.get(seg.module.id), stepCtx, {
                isInputStep: seg.module.kind === "input",
              })}
            />
          )
        })}
      </div>
      )}
      {stepsExpanded && logEndRef ? <div ref={logEndRef} /> : null}
    </div>
  )
}
