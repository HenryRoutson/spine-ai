"use client"

// AI : TODO refactor — thin layout shell only (hooks split: use-inference-docs + use-inference-run-progress).
import { useEffect, useMemo, useRef, useState } from "react"
import {
  FileText,
  CheckCircle2,
  Loader2,
  Circle,
  Zap,
  RotateCcw,
  AlertTriangle,
  Copy,
  Check,
  GitBranch,
  FolderOpen,
  ScrollText,
  Link2,
  CreditCard,
  UserCheck,
  X,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { MIN_RUN_BALANCE_CENTS } from "@/lib/billing_config"
import { formatCostCents, formatUsdFromCents } from "@/lib/format"
import { useAppShell } from "@/lib/app-shell"
import { computeInvalidForUi } from "@/lib/pipeline-validity-ui"
import { modelName } from "@/lib/validity"
import { useDocViewer } from "@/lib/doc-viewer"
import type { DocId, DocRef, InputDescriptionCheckResult, LlmCallRecord, ModuleId, PipelineModule, PipelineRun, RunStep, StepProgress, StepSubProgress } from "@/lib/types"
import type { StepUiState } from "@/lib/run-engine"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { inputTypeLabel, inputNameRestrictionLabel, inputMinCountForModule, docsForInputModule, isMultiDocInputModule } from "@/lib/inference-input"
import { inferenceInputIssueMessage } from "@/lib/inference-validity"
import { InferenceInputPickerPopup } from "@/components/inference-input-picker"
import { segmentPipeline, mergeCombineSegmentStatus } from "@/lib/pipeline-layout"
import { useInferenceRun } from "@/lib/use-inference-run"
import type { RunErrorDisplay } from "@/lib/run-errors"
import { resolveInputDescriptionCheck } from "@/lib/input-description"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { RunNotesPad } from "@/components/run-notes-pad"
import { StepServerLogsSection } from "@/components/server-logs-panel"
import { StepInputDescription, moduleInputDescription } from "@/components/step-input-description"
import { JsonHighlight } from "@/components/highlight"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { LlmCallDistribution } from "@/components/llm-call-distribution"
import { LOGGING_SETTINGS_CHANGED_EVENT } from "@/lib/logging-settings"
import {
  INFERENCE_SETTINGS_CHANGED_EVENT,
  readInferenceOutputStepsOnly,
} from "@/lib/inference-settings"
import type { JobLogEntry } from "@/lib/types"
import type { ClientStepSpec } from "@/lib/run-types"

export function Inference() {
  const {
    project,
    modules,
    models,
    model,
    addRun,
    updateRunNotes,
    docs,
    runs,
    billingAccount,
    refreshBilling,
    inferenceInputDocIds,
    setInferenceInputDocIds,
  } = useStore()
  const { setActiveWindow, openLogging } = useAppShell()
  const { open } = useDocViewer()
  const [, bumpValidityPrefs] = useState(0)
  const [outputStepsOnly, setOutputStepsOnly] = useState(false)
  useEffect(() => {
    const onChange = () => bumpValidityPrefs((n) => n + 1)
    window.addEventListener(LOGGING_SETTINGS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(LOGGING_SETTINGS_CHANGED_EVENT, onChange)
  }, [])
  useEffect(() => {
    setOutputStepsOnly(readInferenceOutputStepsOnly())
    const onChange = () => setOutputStepsOnly(readInferenceOutputStepsOnly())
    window.addEventListener(INFERENCE_SETTINGS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(INFERENCE_SETTINGS_CHANGED_EVENT, onChange)
  }, [])
  const pipelineInvalid = computeInvalidForUi(modules, models).size > 0
  const minRunBalanceCents = billingAccount?.minRunBalanceCents ?? MIN_RUN_BALANCE_CENTS
  const insufficientCredit =
    billingAccount != null && billingAccount.balanceCents < minRunBalanceCents

  const run = useInferenceRun({
    project,
    modules,
    model,
    docs,
    runs,
    inferenceInputDocIds,
    setInferenceInputDocIds,
    addRun,
    updateRunNotes,
    refreshBilling,
  })

  useEffect(() => {
    refreshBilling().catch(console.error)
  }, [refreshBilling])

  const outputSteps = useMemo(() => {
    const all = run.run?.steps.filter((s) => s.outputJson || s.outputPreview.trim()) ?? []
    if (!outputStepsOnly) return all
    return all.filter((s) => s.kind === "output" && s.outputJson)
  }, [run.run, outputStepsOnly])

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="04 / Inference"
        title="Run Pipeline"
        description="Assign inputs and run the pipeline. Final output appears here when the run finishes."
        actions={
          run.phase !== "idle" ? (
            <Button variant="outline" size="sm" className="bg-transparent" onClick={run.reset} disabled={run.phase === "running"}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
            </Button>
          ) : undefined
        }
      />

      {pipelineInvalid ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-6 py-8 max-w-md">
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
            <p className="mt-4 text-sm font-medium text-destructive">
              Fix pipeline errors before running inference.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setActiveWindow("pipeline")}
            >
              <GitBranch className="h-3.5 w-3.5" />
              Go to Pipeline
            </Button>
          </div>
        </div>
      ) : (
      <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl space-y-4 p-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  pipeline inputs · {run.inputModules.length} slot{run.inputModules.length === 1 ? "" : "s"}
                </p>
                <Button variant="outline" size="sm" className="h-7 bg-transparent" onClick={run.useSamples}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> Use samples
                </Button>
              </div>
              {run.inputModules.map((m) => (
                <InferenceInputSlot
                  key={m.id}
                  inputModule={m}
                  outModel={modelName(models, m.outStructureId)}
                  docs={docsForInputModule(run.inputDocs, m.id)}
                  issue={run.inputIssueByModule.get(m.id)}
                  onOpenPicker={() => run.setPickerModuleId(m.id)}
                  onOpenDoc={(docId) => open({ docId, start: 0, end: 0 })}
                  onRemoveDoc={(docId) => run.removeInputDocForModule(m.id, docId)}
                />
              ))}
            </div>

            <RunNotesPad
              value={run.runNotes}
              onChange={run.setRunNotes}
              hint={
                run.phase === "done"
                  ? "Saved when you leave this window"
                  : run.phase === "running"
                    ? "Add notes while the run finishes"
                    : "Describe what you're testing before you run"
              }
            />

            {insufficientCredit && run.phase !== "running" ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-5 text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
                <p className="mt-3 text-sm font-medium text-destructive">
                  Not enough credit to run a pipeline
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  Balance {formatUsdFromCents(billingAccount!.balanceCents)} ·{" "}
                  {formatUsdFromCents(minRunBalanceCents)} minimum to run
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setActiveWindow("billing")}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Go to Billing
                </Button>
              </div>
            ) : (
            <>
            <Button
              className="w-full"
              disabled={
                !run.allInputsReady ||
                run.inputsInvalid ||
                run.phase === "running" ||
                insufficientCredit
              }
              onClick={run.start}
            >
              {run.runButtonBusy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-1.5 h-4 w-4" />
              )}
              {run.runButtonLabel}
            </Button>
            </>
            )}

            {run.pendingHumanReview && (
              <HumanReviewPanel
                spec={run.pendingHumanReview}
                module={modules.find((m) => m.id === run.pendingHumanReview!.moduleId)}
                onApprove={() => run.resolveHumanReview("approved")}
                onReject={() => run.resolveHumanReview("rejected")}
              />
            )}

            {run.inputsInvalid && (
              <ErrorBanner text={inferenceInputIssueMessage(run.inputIssues)} />
            )}

            {run.error && run.phase !== "done" && <ErrorBanner text={run.error} />}

            {(run.phase === "running" || run.phase === "done") && (
              <>
                {run.phase === "done" && outputSteps.length > 0 && (
                  <InferenceRunOutputs steps={outputSteps} />
                )}

                {run.phase === "done" && run.run && run.run.status !== "ok" && (
                  <div className="rounded-lg border border-border bg-card px-6 py-6">
                    {run.runErrorDisplay ? (
                      <RunErrorSummary display={run.runErrorDisplay} technical={run.runErr} />
                    ) : (
                      <div className="text-center">
                        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
                        <p className="mt-4 text-sm font-medium">Pipeline could not finish</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Something went wrong during the run. See step trace below.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-lg border border-border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {run.phase === "done" ? "step trace" : "progress"}
                    </span>
                    <span className="font-mono text-[11px] text-primary">{run.progressPct}%</span>
                  </div>
                  <Progress value={run.progressPct} className="h-1.5" />
                  {run.phase === "running" && (
                    <CyclingWaitPhrase phrase={run.waitPhrase} className="mt-3" />
                  )}
                  {run.phase === "done" && run.run && (
                    <GoToLoggingButton
                      className="mt-4"
                      onClick={() => openLogging(run.run!.id)}
                    />
                  )}
                  <div className="mt-4 space-y-2.5">
                    {segmentPipeline(modules).map((seg) => {
                      if (seg.kind === "combine") {
                        const combineUi = run.stepStates.get(seg.combine.id)
                        const inputUi = run.stepStates.get(seg.input.id)
                        const inputState = inputUi?.status ?? "idle"
                        const state = mergeCombineSegmentStatus(
                          combineUi?.status ?? "idle",
                          inputState,
                        )
                        const combineDesc = stepDescriptionMeta(seg.combine.id, run.run, combineUi)
                        const inputDesc = stepDescriptionMeta(seg.input.id, run.run, inputUi)
                        return (
                          <div key={seg.combine.id} className="space-y-1">
                            <StepRow
                              label={seg.combine.label}
                              state={state}
                              sub={combineUi?.sub}
                              inputDescription={moduleInputDescription(seg.combine)}
                              inputDescriptionCheck={combineDesc.check}
                              descriptionCheckLlmCalls={combineDesc.descriptionCheckLlmCalls}
                              descriptionCheckCostCents={combineDesc.descriptionCheckCostCents}
                              serverLogs={run.logsByModule.get(seg.combine.id) ?? []}
                            />
                            <StepRow
                              label={seg.input.label}
                              state={inputState}
                              sub={inputUi?.sub}
                              nested
                              inputDescription={moduleInputDescription(seg.input)}
                              inputDescriptionCheck={inputDesc.check}
                              descriptionCheckLlmCalls={inputDesc.descriptionCheckLlmCalls}
                              descriptionCheckCostCents={inputDesc.descriptionCheckCostCents}
                              serverLogs={run.logsByModule.get(seg.input.id) ?? []}
                            />
                          </div>
                        )
                      }
                      const moduleUi = run.stepStates.get(seg.module.id)
                      const moduleDesc = stepDescriptionMeta(seg.module.id, run.run, moduleUi)
                      return (
                        <StepRow
                          key={seg.module.id}
                          label={seg.module.label}
                          state={moduleUi?.status ?? "idle"}
                          sub={moduleUi?.sub}
                          isOutputStep={seg.module.kind === "output"}
                          inputDescription={moduleInputDescription(seg.module)}
                          inputDescriptionCheck={moduleDesc.check}
                          descriptionCheckLlmCalls={moduleDesc.descriptionCheckLlmCalls}
                          descriptionCheckCostCents={moduleDesc.descriptionCheckCostCents}
                          serverLogs={run.logsByModule.get(seg.module.id) ?? []}
                        />
                      )
                    })}
                  </div>
                  <div ref={run.logEndRef} />
                </div>
              </>
            )}
          </div>
      </div>
      )}
      {run.pickerModule && (
        <InferenceInputPickerPopup
          inputModule={run.pickerModule}
          selectedDocIds={docsForInputModule(run.inputDocs, run.pickerModule.id).map((d) => d.id)}
          onSelect={(doc) => run.setInputDocForModule(run.pickerModule!.id, doc)}
          onClose={() => run.setPickerModuleId(null)}
        />
      )}
    </div>
  )
}

function InferenceInputSlot({
  inputModule,
  outModel,
  docs,
  issue,
  onOpenPicker,
  onOpenDoc,
  onRemoveDoc,
}: {
  inputModule: PipelineModule
  outModel?: string
  docs: DocRef[]
  issue?: { message: string }
  onOpenPicker: () => void
  onOpenDoc: (docId: DocId) => void
  onRemoveDoc?: (docId: DocId) => void
}) {
  const min = inputMinCountForModule(inputModule)
  const multi = isMultiDocInputModule(inputModule)
  return (
    <div className={cn("rounded-lg border bg-card p-3", issue ? "border-destructive/50" : "border-border")}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium">{inputModule.label}</span>
        <Badge variant="outline" className="font-mono text-[9px] capitalize">
          {inputTypeLabel(inputModule.inputType)}
        </Badge>
        {multi && (
          <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
            min {min} doc{min === 1 ? "" : "s"}
          </Badge>
        )}
        {inputNameRestrictionLabel(inputModule) && (
          <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
            name ∋ "{inputNameRestrictionLabel(inputModule)}"
          </Badge>
        )}
        {outModel && (
          <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
            → {outModel}{multi ? "[]" : ""}
          </Badge>
        )}
      </div>
      <StepInputDescription
        description={moduleInputDescription(inputModule)}
        forceVisible={!!issue}
        className="mb-2"
      />
      {docs.length ? (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenDoc(doc.id)}
                className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-2 py-1.5 font-mono text-[10px] transition-colors hover:border-primary/40 hover:bg-primary/5"
                title="Preview selected document"
              >
                <Link2 className="h-3 w-3 shrink-0 text-primary" />
                <FileText className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate">{doc.name}</span>
              </button>
              {multi && onRemoveDoc && (
                <Button variant="ghost" size="sm" className="h-8" onClick={() => onRemoveDoc(doc.id)}>
                  Remove
                </Button>
              )}
            </div>
          ))}
          {multi && (
            <Button variant="outline" size="sm" className="h-8 bg-transparent" onClick={onOpenPicker}>
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Add document
            </Button>
          )}
          {!multi && (
            <Button variant="outline" size="sm" className="h-8 bg-transparent" onClick={onOpenPicker}>
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Change
            </Button>
          )}
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={onOpenPicker}>
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Choose from store
        </Button>
      )}
      {issue && (
        <p className="mt-2 font-mono text-[10px] text-destructive">{issue.message}</p>
      )}
    </div>
  )
}

function OutputStepLabel() {
  return (
    <span className="shrink-0 rounded border border-white/70 bg-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-foreground">
      output
    </span>
  )
}

function outputStepOutlineClass(isOutputStep: boolean) {
  return isOutputStep ? "border-white/55 ring-1 ring-white/35" : "border-border"
}

function InferenceRunOutputs({ steps }: { steps: RunStep[] }) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">outputs</p>
      {steps.map((step, i) => (
        <InferenceStepOutput
          key={step.moduleId}
          step={step}
          expanded={i === steps.length - 1}
          isOutputStep={step.kind === "output"}
        />
      ))}
    </div>
  )
}

function InferenceStepOutput({
  step,
  expanded,
  isOutputStep,
}: {
  step: RunStep
  expanded: boolean
  isOutputStep: boolean
}) {
  const ok = step.status === "ok" || step.status === "cached"
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card",
        outputStepOutlineClass(isOutputStep),
      )}
    >
      {isOutputStep && (
        <span className="absolute bottom-0 left-0 top-0 w-1 bg-white/90 shadow-[2px_0_8px_rgba(255,255,255,0.15)]" aria-hidden />
      )}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{step.label}</p>
        {isOutputStep && <OutputStepLabel />}
        {step.status === "cached" && (
          <span className="font-mono text-[10px] text-chart-3">cached</span>
        )}
      </div>
      {step.outputJson ? (
        <div className={expanded ? "h-[min(28rem,55vh)]" : "h-[min(16rem,32vh)]"}>
          <JsonPreviewPanel json={step.outputJson} defaultView="table" className="h-full" />
        </div>
      ) : (
        <div className="max-h-48 overflow-auto px-4 py-3">
          <pre className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
            {step.outputPreview}
          </pre>
        </div>
      )}
    </div>
  )
}

function stepDescriptionMeta(
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

function GoToLoggingButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      className={cn(
        "w-full gap-1.5",
        "animate-in fade-in slide-in-from-bottom-2 duration-500",
        "motion-safe:animate-[pulse_2s_ease-in-out_infinite] motion-safe:ring-2 motion-safe:ring-primary/30",
        className,
      )}
      onClick={onClick}
    >
      <ScrollText className="h-3.5 w-3.5" />
      Go to logging
    </Button>
  )
}

function CyclingWaitPhrase({ phrase, className }: { phrase: string; className?: string }) {
  return (
    <p
      key={phrase}
      className={cn(
        "animate-in fade-in duration-500 font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      {phrase}…
    </p>
  )
}

function RunErrorSummary({
  display,
  technical,
  className,
}: {
  display: RunErrorDisplay
  technical?: string | null
  className?: string
}) {
  const [showTechnical, setShowTechnical] = useState(false)
  const copyText = technical ?? display.detail ?? display.message

  return (
    <div className={cn("mx-auto max-w-md space-y-3", className)}>
      <div>
        <p className="text-sm font-medium text-destructive">{display.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{display.message}</p>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">
        Fix the issue above, adjust inputs if needed, then run again. Step traces stay in Logging.
      </p>
      {(display.detail || technical) && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 bg-transparent px-2 text-[10px]"
            onClick={() => setShowTechnical((v) => !v)}
          >
            {showTechnical ? "Hide technical details" : "Show technical details"}
          </Button>
          {showTechnical && (
            <ErrorBanner text={copyText} />
          )}
        </div>
      )}
    </div>
  )
}

function ErrorBanner({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  async function copyError() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
      <p className="min-w-0 flex-1 font-mono text-[11px] text-destructive">{text}</p>
      <Button
        variant="outline"
        size="sm"
        className="h-6 shrink-0 gap-1 bg-transparent px-2 text-[10px]"
        onClick={() => void copyError()}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy error"}
      </Button>
    </div>
  )
}

function StepRow({
  label,
  state,
  nested,
  sub,
  isOutputStep = false,
  inputDescription,
  inputDescriptionCheck,
  descriptionCheckLlmCalls,
  descriptionCheckCostCents,
  serverLogs = [],
}: {
  label: string
  state: StepProgress["status"] | "idle"
  nested?: boolean
  sub?: StepSubProgress
  isOutputStep?: boolean
  inputDescription?: string
  inputDescriptionCheck?: InputDescriptionCheckResult
  descriptionCheckLlmCalls?: LlmCallRecord[]
  descriptionCheckCostCents?: number
  serverLogs?: JobLogEntry[]
}) {
  const descCheckFailed = inputDescriptionCheck?.matches === false
  const showDescCheckCalls =
    (state === "running" || state === "ok" || state === "error") &&
    (descriptionCheckLlmCalls?.length ?? 0) > 0

  const header = (
    <div className="flex items-center gap-2.5">
      {state === "ok" && <CheckCircle2 className="h-4 w-4 text-primary" />}
      {state === "cached" && <Zap className="h-4 w-4 text-chart-3" />}
      {state === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      {state === "error" && <AlertTriangle className="h-4 w-4 text-destructive" />}
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
        className={nested ? "pl-5" : "pl-7"}
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
        <StepServerLogsSection logs={serverLogs} className={nested ? "pl-5" : "pl-7"} />
      )}
    </div>
  )
}

function HumanReviewPanel({
  spec,
  module,
  onApprove,
  onReject,
}: {
  spec: ClientStepSpec
  module?: PipelineModule
  onApprove: () => void
  onReject: () => void
}) {
  const previewJson = useMemo(() => {
    try {
      return JSON.stringify(spec.input, null, 2)
    } catch {
      return String(spec.input)
    }
  }, [spec.input])

  return (
    <div className="rounded-lg border border-chart-1/50 bg-chart-1/5 p-4">
      <div className="flex items-start gap-3">
        <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-chart-1" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-medium">Human review required</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              Step · {spec.label}
            </p>
            {module?.note?.trim() && (
              <p className="mt-2 text-xs text-muted-foreground">{module.note.trim()}</p>
            )}
          </div>
          <div className="max-h-64 min-w-0 overflow-auto rounded-md border border-border bg-[oklch(0.14_0.004_264)] p-2">
            <JsonHighlight json={previewJson} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" onClick={onApprove}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onReject}
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
