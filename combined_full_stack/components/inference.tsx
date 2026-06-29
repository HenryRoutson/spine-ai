"use client"

import { useEffect, useMemo, useRef } from "react"
import {
  FileText,
  Loader2,
  RotateCcw,
  AlertTriangle,
  Zap,
  GitBranch,
  CreditCard,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { MIN_RUN_BALANCE_CENTS } from "@/lib/billing_config"
import { formatUsdFromCents } from "@/lib/format"
import { useAppShell } from "@/lib/app-shell"
import { computeInvalidForUi } from "@/lib/pipeline-validity-ui"
import { modelName } from "@/lib/validity"
import { useDocViewer } from "@/lib/doc-viewer"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { docsForInputModule } from "@/lib/inference-input"
import { inferenceInputIssueMessage } from "@/lib/inference-validity"
import { InferenceInputPickerPopup } from "@/components/inference-input-picker"
import { useInferenceRun } from "@/lib/use-inference-run"
import { RunNotesPad } from "@/components/run-notes-pad"
import { InferenceInputSlot } from "@/components/inference/inference-input-slot"
import { InferenceRunOutputs } from "@/components/inference/inference-outputs"
import {
  ErrorBanner,
  GoToLoggingButton,
  HumanReviewPanel,
  RunErrorSummary,
} from "@/components/inference/inference-run-chrome"
import { InferenceStepTracePanel } from "@/components/inference/inference-step-trace-panel"
import { LOGGING_SETTINGS_CHANGED_EVENT } from "@/lib/logging-settings"
import { ShareLinkDialog } from "@/components/share-link-dialog"
import { useInferenceOutputStepsOnly } from "@/lib/inference-settings"
import { useRerenderOnEvent } from "@/lib/use-browser-pref-event"

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
    flushPendingSave,
  } = useStore()
  const { setActiveWindow, openLogging } = useAppShell()
  const { open } = useDocViewer()
  useRerenderOnEvent(LOGGING_SETTINGS_CHANGED_EVENT)
  const outputStepsOnly = useInferenceOutputStepsOnly()
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
    flushPendingSave,
  })

  useEffect(() => {
    refreshBilling().catch(console.error)
  }, [refreshBilling])

  const outputSteps = useMemo(() => {
    const all = run.run?.steps.filter((s) => s.outputJson || s.outputPreview.trim()) ?? []
    if (!outputStepsOnly) return all
    return all.filter((s) => s.kind === "output" && s.outputJson)
  }, [run.run, outputStepsOnly])

  const outputsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (run.phase !== "done" || outputSteps.length === 0) return
    outputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [run.phase, run.run?.id, outputSteps.length])

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="04 / Inference"
        title="Run Pipeline"
        description="Assign inputs and run the pipeline. Final output appears here when the run finishes."
        actions={
          <div className="flex items-center gap-2">
            <ShareLinkDialog
              project={project}
              docs={docs}
              inferenceInputDocIds={inferenceInputDocIds}
            />
            {run.phase !== "idle" ? (
              <Button variant="outline" size="sm" className="bg-transparent" onClick={run.reset} disabled={run.phase === "running"}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
              </Button>
            ) : null}
          </div>
        }
      />
      <p className="border-b border-border px-5 py-2 text-[11px] text-muted-foreground">
        AI outputs are not professional, medical, or legal advice — verify before acting.
      </p>

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
                  <div ref={outputsRef}>
                    <InferenceRunOutputs steps={outputSteps} models={models} />
                  </div>
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

                <InferenceStepTracePanel
                  modules={modules}
                  phase={run.phase}
                  stepStates={run.stepStates}
                  run={run.run}
                  progressPct={run.progressPct}
                  waitPhrase={run.waitPhrase}
                  logsByModule={run.logsByModule}
                  logEndRef={run.logEndRef}
                  footer={
                    run.phase === "done" && run.run ? (
                      <GoToLoggingButton
                        className="mt-4"
                        onClick={() => openLogging(run.run!.id)}
                      />
                    ) : undefined
                  }
                />
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

