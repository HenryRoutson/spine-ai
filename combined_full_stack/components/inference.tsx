"use client"

// AI : TODO — per-step cache toggles, run-from-step, and cache probe (see requirements/inference_tab_requirements.md).
// AI : TODO (spec) — demo assert: when running seed example setups, compare final output to project.expectedOutputs.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Boxes,
  CreditCard,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  TriangleAlert,
  Zap,
} from "lucide-react"
import { SpineNavIcon } from "@/components/spine-mark"
import { useStore } from "@/lib/store"
import { isPreviewOnly } from "@/lib/demo-mode"
import { MIN_RUN_BALANCE_CENTS } from "@/lib/billing_config"
import { formatUsdFromCents } from "@/lib/format"
import { useAppShell } from "@/lib/app-shell"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"
import { modelName } from "@/lib/validity"
import { useDocViewer } from "@/lib/doc-viewer"
import { WindowHeader } from "@/components/window-header"
import { DeleteButton } from "@/components/delete-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  docsForInputModule,
  resolveRunInputDocIds,
  inputDocsByModuleFromFlat,
  isMultiDocInputModule,
  type InputDocsAssignment,
} from "@/lib/inference-input"
import { inferenceInputIssueClipboard, inferenceInputIssueMessage } from "@/lib/inference-validity"
import { formatErrorForClipboard } from "@/lib/error-copy"
import { InferenceInputPickerPopup } from "@/components/inference-input-picker"
import { InferenceRunPresetMenu, type PresetApplyMeta } from "@/components/inference/inference-run-preset-menu"
import {
  draftFromSetup,
  draftToSetupContent,
  InferenceSetupEditor,
  type SetupDraft,
} from "@/components/inference-setup-editor"
import { useInferenceRun } from "@/lib/use-inference-run"
import { useInferenceTestEval } from "@/lib/use-inference-test-eval"
import { TestResults } from "@/components/test-results"
import { RunNotesPad } from "@/components/run-notes-pad"
import { InferenceInputSlot } from "@/components/inference/inference-input-slot"
import { InputCompatPanel } from "@/components/input-compat-panel"
import { InferenceRunOutputs } from "@/components/inference/inference-outputs"
import {
  ErrorBanner,
  GoToLoggingButton,
  HumanReviewPanel,
  InferenceRunSection,
  RunErrorSummary,
} from "@/components/inference/inference-run-chrome"
import { InferenceStepTracePanel } from "@/components/inference/inference-step-trace-panel"
import { RunWithStopButton } from "@/components/run-with-stop-button"
import { IsolatedErrorButton } from "@/components/logging/isolated-error-actions"
import { useDiagnosisAgents } from "@/lib/diagnosis-agent-context"
import { DiagnosisRunLink } from "@/components/diagnosis-agents/diagnosis-run-link"
import { runHasErrors } from "@/lib/run-error-log"
import { runInputDocsSummary } from "@/lib/inference-input"
import { LOGGING_SETTINGS_CHANGED_EVENT } from "@/lib/logging-settings"
import { pipelineFinalOutputSteps } from "@/lib/step-doc"
import { timeAgo } from "@/lib/time-ago"
import { useRerenderOnEvent } from "@/lib/use-browser-pref-event"
import { docTextContent, fetchDocText, invalidateDocText } from "@/lib/doc-text-cache"
import { docsForProject } from "@/lib/project-docs"
import {
  INFERENCE_SETUP_SUFFIX,
  inferenceSetupSkeleton,
  isInferenceSetupFileName,
  nextInferenceSetupFileName,
  parseInferenceSetupFile,
  resolveInferenceSetupInputs,
  setupDisplayName,
  validateInferenceSetupFile,
  type SetupFileIssue,
  type SpineInferenceSetupFile,
} from "@/lib/inference-setup-files"
import { ResizableSplit } from "@/components/resizable-split"
import { inferenceSidebarSplit } from "@/lib/layout-split-settings"
import { usePersistedLeadingWidth } from "@/lib/use-persisted-leading-width"
import { cn } from "@/lib/utils"
import { DocLabel, InputType } from "@/lib/types"
import type { DocId, DocRef, ModelId, Project } from "@/lib/types"

type SetupDocState = {
  doc: DocRef
  content?: string
  parseError?: string
  setup?: SpineInferenceSetupFile
  issues: SetupFileIssue[]
}

function setupStatus(t: SetupDocState): "loading" | "broken" | "errors" | "warnings" | "ok" {
  if (t.content === undefined) return "loading"
  if (t.parseError) return "broken"
  if (t.issues.some((i) => i.level === "error")) return "errors"
  if (t.issues.length) return "warnings"
  return "ok"
}

const STATUS_BADGE: Record<ReturnType<typeof setupStatus>, { label: string; className: string }> = {
  loading: { label: "loading", className: "border-border text-muted-foreground" },
  broken: { label: "invalid json", className: "border-destructive/40 text-destructive" },
  errors: { label: "stale", className: "border-destructive/40 text-destructive" },
  warnings: { label: "incomplete", className: "border-yellow-500/40 text-yellow-500" },
  ok: { label: "valid", className: "border-chart-2/40 text-chart-2" },
}

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
    addDocContent,
    removeDoc,
    updateRunTest,
  } = useStore()
  const { setActiveWindow, openLogging } = useAppShell()
  const { maybeAutoDiagnose } = useDiagnosisAgents()
  const { open } = useDocViewer()
  useRerenderOnEvent(LOGGING_SETTINGS_CHANGED_EVENT)
  const { typesInvalid, pipelineInvalid } = computeWorkspaceValidity(modules, models, typeAliases)
  const minRunBalanceCents = billingAccount?.minRunBalanceCents ?? MIN_RUN_BALANCE_CENTS
  const insufficientCredit =
    billingAccount != null && billingAccount.balanceCents < minRunBalanceCents
  const previewOnly = isPreviewOnly()

  const projectDocs = useMemo(() => docsForProject(docs, project), [docs, project])
  const setupDocs = useMemo(() => projectDocs.filter((d) => isInferenceSetupFileName(d.name)), [projectDocs])

  const [contents, setContents] = useState<Record<DocId, string>>({})
  const [selectedId, setSelectedId] = useState<DocId | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [creatingSetup, setCreatingSetup] = useState(false)
  const [deletingSetupId, setDeletingSetupId] = useState<DocId | null>(null)
  // AI : when inputs are loaded from a test preset, assert against that file after the run.
  const [linkedTest, setLinkedTest] = useState<PresetApplyMeta | null>(null)
  const { width: sidebarWidth, setWidth: setSidebarWidth, commitWidth: commitSidebarWidth } =
    usePersistedLeadingWidth(inferenceSidebarSplit)

  useEffect(() => {
    for (const d of setupDocs) {
      if (contents[d.id] !== undefined) continue
      void fetchDocText(d.id)
        .then((data) => setContents((prev) => ({ ...prev, [d.id]: docTextContent(data) })))
        .catch((err) => setContents((prev) => ({ ...prev, [d.id]: `<<load failed: ${(err as Error).message}>>` })))
    }
  }, [setupDocs, contents])

  const setupStates: SetupDocState[] = useMemo(
    () =>
      setupDocs.map((doc) => {
        const content = contents[doc.id]
        if (content === undefined) return { doc, issues: [] }
        const parsed = parseInferenceSetupFile(content)
        if (!parsed.ok) return { doc, content, parseError: parsed.error, issues: [] }
        return {
          doc,
          content,
          setup: parsed.setup,
          issues: validateInferenceSetupFile(parsed.setup, project, projectDocs),
        }
      }),
    [setupDocs, contents, project, projectDocs],
  )

  const selected = setupStates.find((s) => s.doc.id === selectedId)

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

  const linkedTestForEval =
    linkedTest?.kind === "test"
      ? { docId: linkedTest.docId, docName: linkedTest.name }
      : null

  const { testResults, testEvaluating, testEvalError } = useInferenceTestEval({
    phase: run.phase,
    run: run.run,
    linkedTest: linkedTestForEval,
    project,
    modules,
    models,
    typeAliases,
    model: model as ModelId,
    updateRunTest,
    refreshBilling,
  })

  const lastAutoDiagnoseRunId = useRef<string | null>(null)
  useEffect(() => {
    if (run.phase !== "done" || !run.run || run.deduped) return
    if (!runHasErrors(run.run)) return
    if (lastAutoDiagnoseRunId.current === run.run.id) return
    lastAutoDiagnoseRunId.current = run.run.id
    maybeAutoDiagnose(
      {
        run: run.run,
        projectId: project.id,
        runLabel: runInputDocsSummary(docs, project, run.run),
      },
      model as ModelId,
    )
  }, [run.phase, run.run, run.deduped, maybeAutoDiagnose, project.id, docs, project, model])

  const applyPreset = useCallback(
    (assignment: InputDocsAssignment, meta?: PresetApplyMeta) => {
      run.applyInputAssignment(assignment)
      setLinkedTest(meta?.kind === "test" ? meta : null)
    },
    [run],
  )

  const applySetupInputs = useCallback(
    (setup: SpineInferenceSetupFile) => {
      setLinkedTest(null)
      const resolved = resolveInferenceSetupInputs(setup, run.inputModules, projectDocs)
      if (resolved.ok) run.applyInputAssignment(resolved.assignment)
    },
    [run, projectDocs],
  )

  const selectSetup = useCallback(
    (id: DocId) => {
      setSelectedId(id)
      setActionError(null)
      const state = setupStates.find((s) => s.doc.id === id)
      if (state?.setup) applySetupInputs(state.setup)
    },
    [setupStates, applySetupInputs],
  )

  async function deleteSetup(docId: DocId, e: React.MouseEvent) {
    e.stopPropagation()
    setActionError(null)
    setDeletingSetupId(docId)
    try {
      await removeDoc(docId, project.id)
      if (selectedId === docId) {
        setSelectedId(null)
        setLinkedTest(null)
      }
      setContents((prev) => {
        const { [docId]: _removed, ...rest } = prev
        return rest
      })
      invalidateDocText(docId)
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setDeletingSetupId(null)
    }
  }

  async function createBlankSetup() {
    setActionError(null)
    setCreatingSetup(true)
    try {
      const doc = await addDocContent(
        nextInferenceSetupFileName(projectDocs),
        InputType.Json,
        inferenceSetupSkeleton(project),
        DocLabel.Inference,
        project.id,
      )
      invalidateDocText(doc.id)
      setContents(({ [doc.id]: _stale, ...rest }) => rest)
      selectSetup(doc.id)
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setCreatingSetup(false)
    }
  }

  async function saveEdit(state: SetupDocState, draft: string): Promise<DocId | null> {
    setActionError(null)
    const parsed = parseInferenceSetupFile(draft)
    if (!parsed.ok) {
      setActionError(parsed.error)
      return null
    }
    try {
      const doc = await addDocContent(
        state.doc.name,
        InputType.Json,
        draft,
        DocLabel.Inference,
        project.id,
        state.doc.id,
      )
      setContents((prev) => {
        const { [state.doc.id]: _old, ...rest } = prev
        return { ...rest, [doc.id]: draft }
      })
      selectSetup(doc.id)
      applySetupInputs(parsed.setup)
      return doc.id
    } catch (err) {
      setActionError((err as Error).message)
      return null
    }
  }

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
        : selected
          ? `Using setup · ${setupDisplayName(selected.doc.name)}`
          : "Pick a saved setup or assign inputs manually, then run"

  const lastRunSubtitle = run.run
    ? `${run.run.status === "ok" ? "Completed" : "Failed"} · ${timeAgo(run.run.startedAt)} · ${run.run.id}`
    : undefined


  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-8" onClick={() => void createBlankSetup()} disabled={creatingSetup}>
              {creatingSetup ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-3.5 w-3.5" />
              )}
              New setup
            </Button>
            {run.phase !== "idle" ? (
              <Button variant="outline" size="sm" className="bg-transparent" onClick={() => { setLinkedTest(null); run.reset() }} disabled={run.phase === "running"}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
              </Button>
            ) : null}
          </div>
        }
      />
      <p className="border-b border-border px-5 py-2 text-[11px] text-muted-foreground">
        AI outputs are not professional, medical, or legal advice — verify before acting.
      </p>

      {actionError && (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 font-mono text-[11px] text-destructive">
          {actionError}
        </p>
      )}

      {typesInvalid ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="max-w-md rounded-lg border border-destructive/50 bg-destructive/10 px-6 py-8">
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
            <p className="mt-4 text-sm font-medium text-destructive">
              Fix type errors in Structure before running inference.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setActiveWindow("structure")}
            >
              <Boxes className="h-3.5 w-3.5" />
              Go to Structure
            </Button>
          </div>
        </div>
      ) : pipelineInvalid ? (
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
              <SpineNavIcon className="h-3.5 w-3.5" />
              Go to Pipeline
            </Button>
          </div>
        </div>
      ) : (
        <ResizableSplit
          className="min-h-0 flex-1"
          leadingWidth={sidebarWidth}
          onLeadingWidthChange={setSidebarWidth}
          onLeadingWidthCommit={commitSidebarWidth}
          minLeading={inferenceSidebarSplit.min}
          maxLeading={inferenceSidebarSplit.max}
          leading={
            <>
              <p className="border-b border-border px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
                saved setups ({setupDocs.length})
              </p>
              <ScrollArea className="min-h-0 flex-1">
                {setupStates.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground">
                    No setups yet. Create one — files ending in{" "}
                    <span className="font-mono">{INFERENCE_SETUP_SUFFIX}</span> show up here and in Documents.
                  </p>
                )}
                <ul className="p-1.5">
                  {setupStates.map((s) => {
                    const status = setupStatus(s)
                    const badge = STATUS_BADGE[status]
                    const isSelected = selected?.doc.id === s.doc.id
                    return (
                      <li key={s.doc.id}>
                        <div
                          className={cn(
                            "flex items-center gap-1 rounded-md px-1 py-1",
                            isSelected && "bg-secondary",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => selectSetup(s.doc.id)}
                            className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1 py-1 text-left hover:bg-accent"
                          >
                            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span
                              className="min-w-0 flex-1 break-all font-mono text-[11px] leading-snug"
                              title={setupDisplayName(s.doc.name)}
                            >
                              {setupDisplayName(s.doc.name)}
                            </span>
                            <Badge variant="outline" className={cn("shrink-0 font-mono text-[9px]", badge.className)}>
                              {badge.label}
                            </Badge>
                          </button>
                          <DeleteButton
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0"
                            deleting={deletingSetupId === s.doc.id}
                            label={`Delete ${setupDisplayName(s.doc.name)}`}
                            onClick={(e) => void deleteSetup(s.doc.id, e)}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </ScrollArea>
            </>
          }
          trailing={
            <ScrollArea className="min-h-0 min-w-0 flex-1">
              <div className="mx-auto max-w-4xl space-y-6 p-5">
              {selected && (
                <SetupDetail
                  key={selected.doc.id}
                  state={selected}
                  project={project}
                  projectDocs={projectDocs}
                  onSaveEdit={(draft) => void saveEdit(selected, draft)}
                  onApplyInputs={applySetupInputs}
                />
              )}

              <InferenceRunSection title="Next run" subtitle={nextRunSubtitle} variant="current">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      pipeline inputs · {run.inputModules.length} slot{run.inputModules.length === 1 ? "" : "s"}
                    </p>
                    <InferenceRunPresetMenu
                      project={project}
                      docs={docs}
                      inputModules={run.inputModules}
                      inputDocs={run.inputDocs}
                      disabled={run.phase === "running"}
                      onApply={applyPreset}
                    />
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
                    {run.inputCompatPairs.length > 0 && (
                      <InputCompatPanel pairs={run.inputCompatPairs} />
                    )}
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

                {previewOnly && run.phase !== "running" ? (
                  <div className="rounded-lg border border-border bg-muted/20 px-4 py-5 text-center">
                    <p className="text-sm font-medium">Preview mode</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      Explore the pipeline — sign in to run inference
                    </p>
                  </div>
                ) : insufficientCredit && run.phase !== "running" ? (
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
                    {run.matchingPriorRun && run.phase === "idle" && (
                      <div className="rounded-lg border border-chart-3/40 bg-chart-3/5 px-4 py-3">
                        <p className="text-sm text-foreground">
                          This setup already completed successfully.
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {timeAgo(run.matchingPriorRun.startedAt)} · {run.matchingPriorRun.id}
                        </p>
                        <GoToLoggingButton
                          className="mt-3"
                          onClick={() => openLogging(run.matchingPriorRun!.id)}
                        />
                      </div>
                    )}
                    <RunWithStopButton
                      className="w-full"
                      runButtonClassName="flex-1"
                      running={run.phase === "running"}
                      onRun={run.start}
                      onStop={() => run.stop()}
                      disabled={
                        !run.allInputsReady ||
                        run.inputsInvalid ||
                        insufficientCredit ||
                        previewOnly
                      }
                      label={run.runButtonLabel}
                      runningLabel={run.runButtonLabel}
                      idleIcon={
                        run.runButtonBusy ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="mr-1.5 h-4 w-4" />
                        )
                      }
                    />
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

                {run.inputsInvalid && run.inputIssues.length > 0 && (
                  <ErrorBanner
                    text={inferenceInputIssueMessage(run.inputIssues, run.inputModules)}
                    copyText={inferenceInputIssueClipboard(
                      run.inputIssues,
                      "Inference → Run Pipeline → input validation",
                      run.inputModules,
                    )}
                    uiLocation="Inference → Run Pipeline → input validation"
                  />
                )}

                {run.inputCompatInvalid && (
                  <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2.5">
                    <p className="font-mono text-[10px] text-yellow-800 dark:text-yellow-400">
                      Input pairing mismatch — fix the highlighted keys above before running. This is separate from
                      pipeline assert steps.
                    </p>
                  </div>
                )}

                {run.error && run.phase !== "done" && (
                  <ErrorBanner
                    text={run.error.split("\n")[0] ?? run.error}
                    copyText={formatErrorForClipboard({
                      uiLocation: "Inference → Run Pipeline → start run",
                      summary: run.error,
                    })}
                    uiLocation="Inference → Run Pipeline → start run"
                  />
                )}

                {run.deduped && run.phase === "done" && (
                  <div className="rounded-lg border border-chart-3/40 bg-chart-3/5 px-4 py-3 text-sm text-foreground">
                    Reused a prior successful run with the same fingerprint — no new inference was billed.
                  </div>
                )}

                {run.phase === "running" && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-primary">
                        Live step logs
                      </p>
                      {run.run?.id ? (
                        <GoToLoggingButton
                          variant="inline"
                          onClick={() => openLogging(run.run!.id)}
                        />
                      ) : null}
                    </div>
                    <InferenceStepTracePanel
                    modules={modules}
                    phase={run.phase}
                    stepStates={run.stepStates}
                    run={run.run}
                    progressPct={run.progressPct}
                    waitPhrase={run.waitPhrase}
                    logsByModule={run.logsByModule}
                    codeExecByModule={run.codeExecByModule}
                    logEndRef={run.logEndRef}
                    docs={docs}
                    models={models}
                    inputDocs={run.inputDocs}
                  />
                  </div>
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

                    {linkedTestForEval && (testEvaluating || testResults || testEvalError) && (
                      <div className="space-y-2">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          test assertion · {linkedTestForEval.docName}
                        </p>
                        {testEvaluating && (
                          <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Comparing outputs against test expectations…
                          </p>
                        )}
                        {testEvalError && (
                          <p className="rounded border border-destructive/30 bg-destructive/10 p-2 font-mono text-[11px] text-destructive">
                            {testEvalError}
                          </p>
                        )}
                        {testResults && <TestResults results={testResults} />}
                      </div>
                    )}

                    {run.run.status !== "ok" && (
                      <div className="rounded-lg border border-border bg-card px-6 py-6 space-y-3">
                        {run.runErrorDisplay ? (
                          <RunErrorSummary
                            display={run.runErrorDisplay}
                            technical={run.runErr}
                            uiLocation="Inference → Last run → error summary"
                          />
                        ) : (
                          <div className="text-center">
                            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
                            <p className="mt-4 text-sm font-medium">Pipeline could not finish</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              See step trace below for details.
                            </p>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <IsolatedErrorButton run={run.run} modules={modules} />
                          <DiagnosisRunLink runId={run.run.id} />
                        </div>
                      </div>
                    )}

                    {run.error && (
                      <ErrorBanner
                        text={run.error.split("\n")[0] ?? run.error}
                        copyText={formatErrorForClipboard({
                          uiLocation: "Inference → Last run → run error",
                          summary: run.error,
                        })}
                        uiLocation="Inference → Last run → run error"
                      />
                    )}

                    <InferenceStepTracePanel
                      modules={modules}
                      phase={run.phase}
                      stepStates={run.stepStates}
                      run={run.run}
                      progressPct={run.progressPct}
                      waitPhrase={run.waitPhrase}
                      logsByModule={run.logsByModule}
                    codeExecByModule={run.codeExecByModule}
                      docs={docs}
                      models={models}
                      inputDocs={lastRunInputDocs}
                      footer={
                        <GoToLoggingButton
                          variant="inline"
                          className="mt-4"
                          onClick={() => openLogging(run.run!.id)}
                        />
                      }
                    />
                  </InferenceRunSection>
                </div>
              )}
            </div>
          </ScrollArea>
          }
        />
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

function SetupDetail({
  state,
  project,
  projectDocs,
  onSaveEdit,
  onApplyInputs,
}: {
  state: SetupDocState
  project: Project
  projectDocs: DocRef[]
  onSaveEdit: (draft: string) => void
  onApplyInputs: (setup: SpineInferenceSetupFile) => void
}) {
  const [draft, setDraft] = useState<SetupDraft | null>(null)
  const [initialSig, setInitialSig] = useState<string | null>(null)

  useEffect(() => {
    if (draft === null && state.setup) {
      const d = draftFromSetup(state.setup)
      setDraft(d)
      setInitialSig(JSON.stringify(d))
    }
  }, [draft, state.setup])

  const dirty = draft !== null && JSON.stringify(draft) !== initialSig
  const serialized = draft ? draftToSetupContent(draft) : null

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="h-4 w-4 text-primary" />
            <span className="truncate font-mono">{setupDisplayName(state.doc.name)}</span>
          </h3>
          {state.issues.length > 0 && (
            <ul className="mt-2 space-y-1">
              {state.issues.map((issue, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-1.5 font-mono text-[11px]",
                    issue.level === "error" ? "text-destructive" : "text-yellow-500",
                  )}
                >
                  <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="whitespace-pre-wrap">
                    <span className="font-semibold">{issue.where}</span> — {issue.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {dirty && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 bg-transparent"
                onClick={() => initialSig && setDraft(JSON.parse(initialSig) as SetupDraft)}
              >
                Discard
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 bg-transparent"
                disabled={serialized === null}
                onClick={() => serialized && onSaveEdit(serialized)}
              >
                Save setup
              </Button>
            </>
          )}
          {!dirty && state.setup && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-transparent"
              onClick={() => onApplyInputs(state.setup!)}
            >
              Apply to run
            </Button>
          )}
        </div>
      </div>

      {state.parseError ? (
        <p className="rounded border border-destructive/30 bg-destructive/10 p-2 font-mono text-[11px] text-destructive">
          {state.parseError}
        </p>
      ) : draft ? (
        <InferenceSetupEditor draft={draft} setDraft={setDraft} project={project} projectDocs={projectDocs} />
      ) : null}
    </div>
  )
}
