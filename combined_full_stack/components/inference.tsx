"use client"

// AI : TODO — per-step cache toggles, run-from-step, and cache probe (see requirements/inference_tab_requirements.md).
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
import { docsForInputModule, resolveRunInputDocIds, inputDocsByModuleFromFlat, isMultiDocInputModule, type InputDocsAssignment } from "@/lib/inference-input"
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
  InferenceRunSection,
  RunErrorSummary,
} from "@/components/inference/inference-run-chrome"
import { InferenceStepTracePanel } from "@/components/inference/inference-step-trace-panel"
import { LOGGING_SETTINGS_CHANGED_EVENT } from "@/lib/logging-settings"
import { ShareLinkDialog } from "@/components/share-link-dialog"
import { pipelineFinalOutputSteps } from "@/lib/step-doc"
import { timeAgo } from "@/lib/time-ago"
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
    typeAliases,
  } = useStore()
  const { setActiveWindow, openLogging } = useAppShell()
  const { open } = useDocViewer()
  useRerenderOnEvent(LOGGING_SETTINGS_CHANGED_EVENT)
  const pipelineInvalid = computeInvalidForUi(modules, models, typeAliases).size > 0
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

  const finalOutputSteps = useMemo(
    () => (run.run ? pipelineFinalOutputSteps(run.run.steps) : []),
    [run.run],
  )

  const lastRunInputDocs = useMemo((): InputDocsAssignment => {
    if (!run.run) return run.inputDocs
    const ids = resolveRunInputDocIds(docs, project, run.run)
    const byModule = inputDocsByModuleFromFlat(run.inputModules, ids)
    const out: InputDocsAssignment = {}
    for (const m of run.inputModules) {
      const moduleIds = byModule[m.id]
      if (!moduleIds?.length) continue
      const refs = moduleIds
        .map((id) => docs.find((d) => d.id === id))
        .filter((d): d is (typeof docs)[number] => d != null)
      if (!refs.length) continue
      out[m.id] = isMultiDocInputModule(m) ? refs : refs[0]
    }
    return out
  }, [run.run, run.inputDocs, run.inputModules, docs, project])

  const lastRunRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (run.phase !== "done" || finalOutputSteps.length === 0) return
    lastRunRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [run.phase, run.run?.id, finalOutputSteps.length])

  const nextRunSubtitle =
    run.phase === "running"
      ? "Run in progress — inputs locked until it finishes"
      : run.phase === "done"
        ? "Change files here to run again with different inputs"
        : "Choose files for each input slot, then run the pipeline"

  const lastRunSubtitle = run.run
    ? `${run.run.status === "ok" ? "Completed" : "Failed"} · ${timeAgo(run.run.startedAt)} · ${run.run.id}`
    : undefined

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
          <div className="mx-auto max-w-4xl space-y-6 p-5">
            <InferenceRunSection title="Next run" subtitle={nextRunSubtitle} variant="current">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    pipeline inputs · {run.inputModules.length} slot{run.inputModules.length === 1 ? "" : "s"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 bg-transparent"
                    onClick={run.useSamples}
                    disabled={run.phase === "running"}
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5" /> Use samples
                  </Button>
                </div>
                <div className={run.phase === "running" ? "pointer-events-none opacity-60" : undefined}>
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
              </div>

              <RunNotesPad
                value={run.runNotes}
                onChange={run.setRunNotes}
                hint={
                  run.phase === "done"
                    ? "Notes for your next run"
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

              {run.phase === "running" && (
                <InferenceStepTracePanel
                  modules={modules}
                  phase={run.phase}
                  stepStates={run.stepStates}
                  run={run.run}
                  progressPct={run.progressPct}
                  waitPhrase={run.waitPhrase}
                  logsByModule={run.logsByModule}
                  logEndRef={run.logEndRef}
                  docs={docs}
                  models={models}
                  inputDocs={run.inputDocs}
                />
              )}
            </InferenceRunSection>

            {run.phase === "done" && run.run && (
              <div ref={lastRunRef}>
              <InferenceRunSection
                title="Last run"
                subtitle={lastRunSubtitle}
                variant="last"
              >
                {finalOutputSteps.length > 0 && (
                  <InferenceRunOutputs steps={finalOutputSteps} models={models} />
                )}

                {run.run.status !== "ok" && (
                  <div className="rounded-lg border border-border bg-card px-6 py-6">
                    {run.runErrorDisplay ? (
                      <RunErrorSummary display={run.runErrorDisplay} technical={run.runErr} />
                    ) : (
                      <div className="text-center">
                        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
                        <p className="mt-4 text-sm font-medium">Pipeline could not finish</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          See step trace below for details.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {run.error && <ErrorBanner text={run.error} />}

                <InferenceStepTracePanel
                  modules={modules}
                  phase={run.phase}
                  stepStates={run.stepStates}
                  run={run.run}
                  progressPct={run.progressPct}
                  waitPhrase={run.waitPhrase}
                  logsByModule={run.logsByModule}
                  docs={docs}
                  models={models}
                  inputDocs={lastRunInputDocs}
                  footer={
                    <GoToLoggingButton
                      className="mt-4"
                      onClick={() => openLogging(run.run!.id)}
                    />
                  }
                />
              </InferenceRunSection>
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
