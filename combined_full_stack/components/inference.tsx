"use client"

// AI : TODO refactor — thin layout shell once use-inference-run.ts is split into focused hooks.
import { useEffect, useRef, useState } from "react"
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
} from "lucide-react"
import { useStore } from "@/lib/store"
import { MIN_RUN_BALANCE_CENTS } from "@/lib/billing_config"
import { formatUsdFromCents } from "@/lib/format"
import { useAppShell } from "@/lib/app-shell"
import { computeInvalid, modelName } from "@/lib/validity"
import { useDocViewer } from "@/lib/doc-viewer"
import type { DocId, DocRef, ModuleId, PipelineModule } from "@/lib/types"
import type { StepProgress, StepSubProgress } from "@/lib/run-engine"
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
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { RunNotesPad } from "@/components/run-notes-pad"
import { StepServerLogsSection } from "@/components/server-logs-panel"
import type { JobLogEntry } from "@/lib/types"

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
  const pipelineInvalid = computeInvalid(modules, models).size > 0
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

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="04 / Inference"
        title="Run Pipeline"
        description="Assign inputs and run the pipeline. Full output and traces live in Logging."
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
          <div className="mx-auto max-w-2xl space-y-4 p-5">
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
                run.validatingInputs ||
                run.probingCache ||
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

            {run.inputsInvalid && !run.validatingInputs && (
              <ErrorBanner text={inferenceInputIssueMessage(run.inputIssues)} />
            )}

            {run.error && run.phase !== "done" && <ErrorBanner text={run.error} />}

            {run.run && run.phase === "done" && (
              <div className="rounded-lg border border-border bg-card px-6 py-8 text-center">
                {run.wasDeduped ? (
                  <Zap className="mx-auto h-10 w-10 text-primary" />
                ) : run.run.status === "ok" ? (
                  <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
                ) : (
                  <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
                )}
                <p className="mt-4 text-sm font-medium">
                  {run.wasDeduped
                    ? "Identical run already completed"
                    : run.run.status === "ok"
                      ? "Pipeline finished"
                      : "Pipeline finished with errors"}
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {run.wasDeduped
                    ? "Pipeline and inputs match a previous run — no compute was used."
                    : "Output, step traces, and costs are in Logging."}
                </p>
                {run.runErr && (
                  <div className="mt-4 text-left">
                    <ErrorBanner text={run.runErr} />
                  </div>
                )}
              </div>
            )}

            {(run.phase === "running" || run.phase === "done") && (
              <div className="rounded-lg border border-border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    progress
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
                    deduped={run.wasDeduped}
                    onClick={() => openLogging(run.loggingRunId ?? run.run!.id)}
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
                      return (
                        <div key={seg.combine.id} className="space-y-1">
                          <StepRow
                            label={seg.combine.label}
                            state={state}
                            sub={combineUi?.sub}
                            serverLogs={run.logsByModule.get(seg.combine.id) ?? []}
                          />
                          <StepRow
                            label={seg.input.label}
                            state={inputState}
                            sub={inputUi?.sub}
                            nested
                            serverLogs={run.logsByModule.get(seg.input.id) ?? []}
                          />
                        </div>
                      )
                    }
                    const moduleUi = run.stepStates.get(seg.module.id)
                    return (
                      <StepRow
                        key={seg.module.id}
                        label={seg.module.label}
                        state={moduleUi?.status ?? "idle"}
                        sub={moduleUi?.sub}
                        serverLogs={run.logsByModule.get(seg.module.id) ?? []}
                      />
                    )
                  })}
                </div>
                <div ref={run.logEndRef} />
              </div>
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

function GoToLoggingButton({
  deduped,
  onClick,
  className,
}: {
  deduped: boolean
  onClick: () => void
  className?: string
}) {
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
      {deduped ? "View cached run in Logging" : "Go to logging"}
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
  serverLogs = [],
}: {
  label: string
  state: StepProgress["status"] | "idle"
  nested?: boolean
  sub?: StepSubProgress
  serverLogs?: JobLogEntry[]
}) {
  return (
    <div className={cn(nested && "pl-5")}>
      <div className="flex items-center gap-2.5">
        {state === "ok" && <CheckCircle2 className="h-4 w-4 text-primary" />}
        {state === "cached" && <Zap className="h-4 w-4 text-chart-3" />}
        {state === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        {state === "error" && <AlertTriangle className="h-4 w-4 text-destructive" />}
        {state === "idle" && <Circle className="h-4 w-4 text-muted-foreground/40" />}
        <span className={cn("flex-1 text-xs", state === "idle" ? "text-muted-foreground" : "text-foreground")}>
          {label}
        </span>
        {state === "cached" && <span className="font-mono text-[10px] text-chart-3">cache · $0.00</span>}
      </div>
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
