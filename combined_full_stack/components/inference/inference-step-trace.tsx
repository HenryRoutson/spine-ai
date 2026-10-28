"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  Zap,
} from "lucide-react"
import { LlmCallDistribution } from "@/components/llm-call-distribution"
import { StepServerLogsSection } from "@/components/server-logs-panel"
import { StepInputDescription } from "@/components/step-input-description"
import { StepLoadedDocSection } from "@/components/step-loaded-doc-section"
import { StepPromptSection } from "@/components/step-prompt-section"
import { Progress } from "@/components/ui/progress"
import { formatCostCents } from "@/lib/format"
import { resolveInputDescriptionCheck } from "@/lib/input-description"
import { cn } from "@/lib/utils"
import { useStatusPalette } from "@/lib/chart-colors"
import type { StepUiState } from "@/lib/run-engine"
import type {
  DocRef,
  InputDescriptionCheckResult,
  JobLogEntry,
  LlmCallRecord,
  ModuleId,
  PipelineRun,
  RunStep,
  StepProgress,
  StepSubProgress,
  StructureModel,
  PipelineModule,
} from "@/lib/types"
import { CustomCodeLanguage } from "@/lib/types"
import { OutputStepLabel, outputStepOutlineClass, StepTraceOutputPreview, stepHasTraceOutput } from "@/components/inference/inference-outputs"
import { StepCodeExecPreview } from "@/components/step-code-exec-preview"
import { StepValidationErrorsSection } from "@/components/step-validation-errors-section"
import { stepHasPromptPreview } from "@/lib/prompt-cache-regions"
import { isDocReferenceOutputJson } from "@/lib/step-doc"
import { firstUserCodeEntry } from "@/lib/custom_code"
import type { CodeExecUiState } from "@/lib/code-exec-ui"
import { stepTraceIndentClass } from "@/lib/step-trace-layout"
import {
  formatStepElapsed,
  STEP_RUNNING_WARN_MS,
  stepRunningLimitMs,
} from "@/lib/step-running-watch"

export { stepTraceIndentClass } from "@/lib/step-trace-layout"

function useStepRunningElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!active) {
      setElapsed(0)
      return
    }
    const t0 = performance.now()
    const id = window.setInterval(() => setElapsed(performance.now() - t0), 250)
    return () => window.clearInterval(id)
  }, [active])
  return elapsed
}

export function stepDescriptionMeta(
  moduleId: ModuleId,
  run: PipelineRun | null | undefined,
  stepUi?: StepUiState,
) {
  const runStep = run?.steps.find((s) => s.moduleId === moduleId)
  return {
    check: resolveInputDescriptionCheck(
      runStep?.inputDescriptionCheck ?? stepUi?.inputDescriptionCheck,
      runStep?.outputPreview ?? stepUi?.outputPreview,
    ),
    descriptionCheckLlmCalls:
      runStep?.descriptionCheckLlmCalls ?? stepUi?.descriptionCheckLlmCalls,
    descriptionCheckCostCents:
      runStep?.descriptionCheckCostCents ?? stepUi?.descriptionCheckCostCents,
  }
}

export function InferenceStepRow({
  label,
  state,
  nested,
  sub,
  isOutputStep = false,
  isInputStep = false,
  runStep,
  assignedInputDocs = [],
  docs = [],
  models,
  inputDescription,
  inputDescriptionCheck,
  descriptionCheckLlmCalls,
  descriptionCheckCostCents,
  serverLogs = [],
  forceCollapsedLogs = false,
  showStepIo = false,
  ioCompact = true,
  outputPreview,
  module,
  codeExec,
  runId,
}: {
  label: string
  state: StepProgress["status"] | "idle"
  nested?: boolean
  sub?: StepSubProgress
  isOutputStep?: boolean
  isInputStep?: boolean
  runStep?: RunStep
  assignedInputDocs?: DocRef[]
  docs?: DocRef[]
  models?: StructureModel[]
  inputDescription?: string
  inputDescriptionCheck?: InputDescriptionCheckResult
  descriptionCheckLlmCalls?: LlmCallRecord[]
  descriptionCheckCostCents?: number
  serverLogs?: JobLogEntry[]
  forceCollapsedLogs?: boolean
  showStepIo?: boolean
  ioCompact?: boolean
  outputPreview?: string
  module?: PipelineModule
  codeExec?: CodeExecUiState
  runId?: string
}) {
  const palette = useStatusPalette()
  const runningElapsed = useStepRunningElapsed(state === "running")
  const runningLimitMs = stepRunningLimitMs(module?.maxRunMs)
  const runningSlow = state === "running" && runningElapsed >= STEP_RUNNING_WARN_MS
  const runningOverLimit = state === "running" && runningElapsed >= runningLimitMs
  const descCheckFailed = inputDescriptionCheck?.matches === false
  const showDescCheckCalls =
    (state === "running" || state === "ok" || state === "error") &&
    (descriptionCheckLlmCalls?.length ?? 0) > 0
  const stepFinished = state === "ok" || state === "cached" || state === "error"
  const errorPreview =
    state === "error" ? (runStep?.outputPreview ?? outputPreview)?.trim() : undefined
  const showValidationErrors = showStepIo && stepFinished && !!errorPreview
  const showInputDocPreview =
    isInputStep && showStepIo && stepFinished && (runStep != null || assignedInputDocs.length > 0)
  const showPromptPreview =
    showStepIo && stepFinished && !isInputStep && !!runStep && stepHasPromptPreview(runStep)
  const showOutputPreview =
    showStepIo &&
    stepFinished &&
    ((runStep?.outputJson && !isDocReferenceOutputJson(runStep.outputJson)) ||
      (!showValidationErrors && stepHasTraceOutput(runStep, outputPreview, isInputStep)))
  const ioClassName = stepTraceIndentClass(nested)
  const codeEntry = module ? firstUserCodeEntry(module) : undefined
  const displayCode = codeExec?.code ?? codeEntry?.code
  const showCodeExec =
    !!displayCode &&
    (state === "running" ||
      codeExec?.status === "running" ||
      codeExec?.status === "done" ||
      codeExec?.status === "error")

  const header = (
    <div className="flex items-center gap-2.5">
      {state === "ok" && <CheckCircle2 className="h-4 w-4" style={{ color: palette.ok }} />}
      {state === "cached" && <Zap className="h-4 w-4 text-chart-3" />}
      {state === "running" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {state === "error" && <AlertTriangle className="h-4 w-4" style={{ color: palette.err }} />}
      {state === "idle" && <Circle className="h-4 w-4 text-muted-foreground/40" />}
      <span className={cn("flex-1 text-xs", state === "idle" ? "text-muted-foreground" : "text-foreground")}>
        {label}
      </span>
      {isOutputStep && <OutputStepLabel />}
      {state === "cached" && <span className="font-mono text-[10px] text-chart-3">cache · $0.00</span>}
      {descriptionCheckCostCents != null && descriptionCheckCostCents > 0 && state !== "idle" && state !== "cached" && (
        <span className="font-mono text-[10px] text-muted-foreground">
          desc check · {formatCostCents(descriptionCheckCostCents)}
        </span>
      )}
      {state === "running" && runningElapsed >= 500 && (
        <span
          className={cn(
            "font-mono text-[10px] tabular-nums",
            runningOverLimit ? "text-destructive" : runningSlow ? "text-chart-4" : "text-muted-foreground",
          )}
        >
          {formatStepElapsed(runningElapsed)}
          {runningOverLimit ? ` · max ${formatStepElapsed(runningLimitMs)}` : ""}
        </span>
      )}
    </div>
  )

  return (
    <div className={cn("relative", nested && "pl-5")}>
      {isOutputStep ? (
        <div className={cn("relative rounded-md border px-2.5 py-2", outputStepOutlineClass(true))}>
          <span className="absolute bottom-1 left-0 top-1 w-1 rounded-r bg-white/90" aria-hidden />
          {header}
        </div>
      ) : (
        header
      )}
      <StepInputDescription
        description={inputDescription}
        check={inputDescriptionCheck}
        forceVisible={descCheckFailed}
        className={ioClassName}
      />
      {showDescCheckCalls && (
        <LlmCallDistribution
          calls={descriptionCheckLlmCalls}
          compact
          title="Description validation"
          stepSucceeded={!descCheckFailed}
        />
      )}
      {state === "running" && sub && (
        <div className="mt-1 pl-7">
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] text-muted-foreground">{sub.label}</span>
            {sub.total > 1 && (
              <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
                {sub.current}/{sub.total}
              </span>
            )}
          </div>
          {sub.total === 1 && sub.current === 0 ? (
            <div className="relative h-0.5 overflow-hidden rounded-full bg-muted">
              <div className="absolute h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary/70" />
            </div>
          ) : (
            <Progress value={sub.total > 0 ? Math.round((sub.current / sub.total) * 100) : 0} className="h-0.5" />
          )}
        </div>
      )}
      {serverLogs.length > 0 && (
        <StepServerLogsSection
          logs={serverLogs}
          className={ioClassName}
          forceCollapsed={forceCollapsedLogs}
        />
      )}
      {showCodeExec && displayCode && (
        <StepCodeExecPreview
          code={displayCode}
          language={codeExec?.language ?? codeEntry?.language ?? CustomCodeLanguage.TypeScript}
          activeLine={codeExec?.activeLine}
          activeSlot={codeExec?.activeSlot}
          lineMs={codeExec?.lineMs}
          // AI : don't inherit step "running" — that includes server description-check before code runs.
          status={codeExec?.status}
          compact={ioCompact}
          className={ioClassName}
        />
      )}
      {showPromptPreview && runStep && (
        <StepPromptSection
          step={runStep}
          label={label}
          runId={runId}
          models={models}
          className={ioClassName}
        />
      )}
      {showInputDocPreview && (
        <StepLoadedDocSection
          step={runStep}
          assignedDocs={assignedInputDocs}
          docs={docs}
          models={models}
          className={ioClassName}
        />
      )}
      {showValidationErrors && errorPreview && (
        <StepValidationErrorsSection
          errorPreview={errorPreview}
          runId={runId}
          className={ioClassName}
        />
      )}
      {showOutputPreview && (
        <StepTraceOutputPreview
          runStep={runStep}
          outputPreview={outputPreview}
          models={models}
          compact={ioCompact}
          className={ioClassName}
        />
      )}
    </div>
  )
}
