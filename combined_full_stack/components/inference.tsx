"use client"

import { useMemo, useRef, useState, useEffect } from "react"
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
import { useAppShell } from "@/lib/app-shell"
import { computeInvalid, modelName } from "@/lib/validity"
import { useDocViewer } from "@/lib/doc-viewer"
import {
  awaitRun,
  isRunBillingError,
  mergeStepStates,
  startRun,
  type JobLogEntry,
  type StepProgress,
  type StepSubProgress,
  type StepUiState,
} from "@/lib/run-engine"
import type { DocId, DocRef, ModuleId, PipelineModule, PipelineRun, Project, ProjectId } from "@/lib/types"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { defaultInferenceDoc } from "@/lib/project-docs"
import { defaultInputDocsForModules, inputTypeLabel, inputNameRestrictionLabel, orderedInputModules } from "@/lib/inference-input"
import {
  collectInferenceInputIssues,
  inferenceInputIssueMessage,
  type InferenceInputIssue,
} from "@/lib/inference-validity"
import { InferenceInputPickerPopup } from "@/components/inference-input-picker"
import { useRunNotesFlushOnLeave } from "@/lib/run-notes-flush"
import { segmentPipeline } from "@/lib/pipeline-layout"
import { useCyclingWaitPhrase } from "@/lib/inference-wait-phrases"
import { RunNotesPad } from "@/components/run-notes-pad"

type Phase = "idle" | "running" | "done"

// AI : step errors are stored on RunStep.outputPreview — surface them instead of a generic "run error".
function pipelineRunError(run: PipelineRun): string | null {
  const step = run.steps.find((s) => s.status === "error")
  if (!step) return run.status === "error" ? "Pipeline failed" : null
  return step.outputPreview ? `${step.label}: ${step.outputPreview}` : `${step.label} failed`
}

function buildDefaultInputDocs(
  docs: DocRef[],
  project: Project,
  inputModules: PipelineModule[],
): Partial<Record<ModuleId, DocRef>> {
  return defaultInputDocsForModules(docs, project, inputModules, defaultInferenceDoc(docs, project))
}

// AI : client-side mirror of run dedup inputs — blocks re-run when pipeline + inputs unchanged.
function inferenceConfigKey(
  projectId: ProjectId,
  model: string,
  inputModules: PipelineModule[],
  inputDocs: Partial<Record<ModuleId, DocRef>>,
  modules: PipelineModule[],
): string | null {
  if (!inputModules.every((m) => inputDocs[m.id])) return null
  return JSON.stringify({
    projectId,
    model,
    inputs: inputModules.map((m) => inputDocs[m.id]!.id),
    modules: modules.map((m) => ({
      id: m.id,
      kind: m.kind,
      prompt: m.prompt,
      code: m.code,
      model: m.model,
      inStructureId: m.inStructureId,
      outStructureId: m.outStructureId,
      inputType: m.inputType,
      inputNameContains: m.inputNameContains,
      outIsList: m.outIsList,
    })),
  })
}

export function Inference() {
  const { project, modules, models, model, addRun, updateRunNotes, docs, runs, billingAccount, refreshBilling } = useStore()
  const { setActiveWindow, openLogging } = useAppShell()
  const { open } = useDocViewer()
  const pipelineInvalid = computeInvalid(modules, models).size > 0
  const minRunBalanceCents = billingAccount?.minRunBalanceCents ?? MIN_RUN_BALANCE_CENTS
  const insufficientCredit =
    billingAccount != null && billingAccount.balanceCents < minRunBalanceCents

  const [inputDocs, setInputDocs] = useState<Partial<Record<ModuleId, DocRef>>>({})
  const [inputIssues, setInputIssues] = useState<InferenceInputIssue[]>([])
  const [validatingInputs, setValidatingInputs] = useState(false)
  const [pickerModuleId, setPickerModuleId] = useState<ModuleId | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [stepStates, setStepStates] = useState<Map<ModuleId, StepUiState>>(new Map())
  const [run, setRun] = useState<PipelineRun | null>(null)
  const [dedupedRunId, setDedupedRunId] = useState<string | null>(null)
  const [completedConfigKey, setCompletedConfigKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugLogs, setDebugLogs] = useState<JobLogEntry[]>([])
  const [runNotes, setRunNotes] = useState("")
  const runNotesRef = useRef("")
  const savedNotesRef = useRef<string | undefined>(undefined)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    runNotesRef.current = runNotes
  }, [runNotes])

  // AI : balance gates Run — refresh when Inference opens so $0 shows Billing CTA without a failed run.
  useEffect(() => {
    refreshBilling().catch(console.error)
  }, [refreshBilling])

  const inputModules = useMemo(() => orderedInputModules(modules), [modules])
  const pickerModule = pickerModuleId ? inputModules.find((m) => m.id === pickerModuleId) : undefined
  const allInputsReady = inputModules.every((m) => inputDocs[m.id])
  const inputsInvalid = inputIssues.length > 0
  const inputIssueByModule = useMemo(
    () => new Map(inputIssues.map((issue) => [issue.moduleId, issue])),
    [inputIssues],
  )
  const currentConfigKey = useMemo(
    () => inferenceConfigKey(project.id as ProjectId, model, inputModules, inputDocs, modules),
    [project.id, model, inputModules, inputDocs, modules],
  )
  const configAlreadyCompleted =
    phase === "done" &&
    run?.status === "ok" &&
    completedConfigKey != null &&
    currentConfigKey === completedConfigKey
  const cachedLoggingRunId = dedupedRunId ?? (configAlreadyCompleted ? run?.id : null)

  // AI : Inference unmounts on tab switch — ask the server (same dedup logic as POST /api/runs) to restore completed state.
  useEffect(() => {
    if (!allInputsReady || !currentConfigKey || phase === "running") return
    if (phase === "done" && completedConfigKey === currentConfigKey && run?.status === "ok") return

    let cancelled = false
    async function restoreCachedRun() {
      const orderedIds = inputModules.map((m) => inputDocs[m.id]!.id as DocId)
      const [primary, ...rest] = orderedIds
      const res = await fetch("/api/runs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          inputDocId: primary,
          inputDocIds: rest,
          model,
        }),
      })
      if (!res.ok || cancelled) return
      const data = (await res.json()) as { cachedRunId?: string | null; run?: PipelineRun | null }
      if (!data.cachedRunId) return
      setRun(data.run ?? runs.find((r) => r.id === data.cachedRunId) ?? null)
      setPhase("done")
      setCompletedConfigKey(currentConfigKey)
      setDedupedRunId(data.cachedRunId)
    }
    void restoreCachedRun()
    return () => {
      cancelled = true
    }
  }, [
    allInputsReady,
    completedConfigKey,
    currentConfigKey,
    inputDocs,
    inputModules,
    model,
    phase,
    project.id,
    run?.status,
  ])

  // AI : changing inputs or pipeline after a completed run should re-enable Run pipeline.
  useEffect(() => {
    if (phase !== "done" || !completedConfigKey || currentConfigKey === completedConfigKey) return
    setPhase("idle")
    setRun(null)
    setDedupedRunId(null)
    setCompletedConfigKey(null)
  }, [phase, completedConfigKey, currentConfigKey])

  // AI : validate assigned docs before run — catch seed placeholders + invalid JSON early.
  useEffect(() => {
    let cancelled = false
    async function validateInputs() {
      const assigned = inputModules.filter((m) => inputDocs[m.id])
      if (!assigned.length) {
        setInputIssues([])
        return
      }
      setValidatingInputs(true)
      const contentByDocId: Partial<Record<string, string>> = {}
      try {
        await Promise.all(
          assigned.map(async (m) => {
            const doc = inputDocs[m.id]!
            const res = await fetch(`/api/docs/${doc.id}/text`)
            if (res.ok) contentByDocId[doc.id] = await res.text()
          }),
        )
      } finally {
        if (!cancelled) setValidatingInputs(false)
      }
      if (cancelled) return
      setInputIssues(collectInferenceInputIssues(inputModules, inputDocs, contentByDocId))
    }
    void validateInputs()
    return () => {
      cancelled = true
    }
  }, [inputModules, inputDocs])

  // AI : seed input slots on mount / project switch — run UI state is restored separately via /api/runs/match.
  useEffect(() => {
    setInputDocs(buildDefaultInputDocs(docs, project, inputModules))
    setInputIssues([])
    setPickerModuleId(null)
    setPhase("idle")
    setStepStates(new Map())
    setRun(null)
    setDedupedRunId(null)
    setCompletedConfigKey(null)
    setError(null)
    setDebugLogs([])
    setRunNotes("")
    savedNotesRef.current = undefined
  }, [project.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [debugLogs.length])

  useRunNotesFlushOnLeave(
    phase === "done" ? run?.id : undefined,
    runNotes,
    run?.notes,
    updateRunNotes,
    (id, next) => {
      savedNotesRef.current = next
      setRun((r) => (r?.id === id ? { ...r, notes: next } : r))
    },
  )

  function setInputDocForModule(moduleId: ModuleId, doc: DocRef) {
    setInputDocs((prev) => ({ ...prev, [moduleId]: doc }))
    setPickerModuleId(null)
  }

  function useSamples() {
    setInputDocs(buildDefaultInputDocs(docs, project, inputModules))
  }

  async function start() {
    if (!allInputsReady || inputsInvalid || insufficientCredit) return
    const orderedIds = inputModules.map((m) => inputDocs[m.id]!.id as DocId)
    const [primary, ...rest] = orderedIds
    if (phase === "done") {
      setRunNotes("")
      runNotesRef.current = ""
    }
    setPhase("running")
    setError(null)
    setRun(null)
    setDedupedRunId(null)
    setStepStates(new Map())
    setDebugLogs([])
    try {
      const { jobId } = await startRun(project.id as ProjectId, primary, model, rest)
      refreshBilling().catch(console.error)
      const { run: finished, deduped, cachedRunId } = await awaitRun(jobId, {
        onStep: (steps) => setStepStates((prev) => mergeStepStates(prev, steps)),
        onLogs: (logs) => setDebugLogs(logs),
      })
      const notes = runNotesRef.current.trim() || undefined
      const withNotes = notes ? { ...finished, notes } : finished
      savedNotesRef.current = notes
      setRun(withNotes)
      setDedupedRunId(deduped ? (cachedRunId ?? finished.id) : null)
      if (finished.status === "ok" && currentConfigKey) setCompletedConfigKey(currentConfigKey)
      if (!deduped) {
        addRun(withNotes)
        if (notes) updateRunNotes(finished.id, notes).catch(console.error)
      }
      const runErr = pipelineRunError(finished)
      if (runErr) setError(runErr)
      setPhase("done")
    } catch (e) {
      if (isRunBillingError(e)) {
        refreshBilling().catch(console.error)
      } else {
        setError((e as Error).message)
      }
      setPhase("idle")
    }
  }

  function reset() {
    setPhase("idle")
    setStepStates(new Map())
    setRun(null)
    setDedupedRunId(null)
    setCompletedConfigKey(null)
    setError(null)
    setDebugLogs([])
    setRunNotes("")
    savedNotesRef.current = undefined
  }

  const progressPct = useMemo(() => {
    if (phase === "idle") return 0
    if (phase === "done") return 100
    const done = modules.filter((m) => {
      const s = stepStates.get(m.id)?.status
      return s !== undefined && s !== "idle" && s !== "running"
    }).length
    return Math.round((done / Math.max(1, modules.length)) * 100)
  }, [phase, stepStates, modules.length])

  const runningHints = useMemo(() => {
    const hints: string[] = []
    for (const seg of segmentPipeline(modules)) {
      if (seg.kind === "combine") {
        const combineUi = stepStates.get(seg.combine.id)
        const inputUi = stepStates.get(seg.input.id)
        if (combineUi?.status === "running") {
          hints.push(combineUi.sub?.label ?? seg.combine.label)
        }
        if (inputUi?.status === "running") {
          hints.push(inputUi.sub?.label ?? seg.input.label)
        }
        continue
      }
      const moduleUi = stepStates.get(seg.module.id)
      if (moduleUi?.status === "running") {
        hints.push(moduleUi.sub?.label ?? seg.module.label)
      }
    }
    return hints
  }, [stepStates, modules])

  const waitPhrase = useCyclingWaitPhrase(phase === "running", runningHints)
  const runErr = useMemo(() => (run ? pipelineRunError(run) : null), [run])

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="04 / Inference"
        title="Run Pipeline"
        description="Assign inputs and run the pipeline. Full output and traces live in Logging."
        actions={
          phase !== "idle" ? (
            <Button variant="outline" size="sm" className="bg-transparent" onClick={reset} disabled={phase === "running"}>
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
                  pipeline inputs · {inputModules.length} slot{inputModules.length === 1 ? "" : "s"}
                </p>
                <Button variant="outline" size="sm" className="h-7 bg-transparent" onClick={useSamples}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> Use samples
                </Button>
              </div>
              {inputModules.map((m) => (
                <InferenceInputSlot
                  key={m.id}
                  inputModule={m}
                  outModel={modelName(models, m.outStructureId)}
                  doc={inputDocs[m.id]}
                  issue={inputIssueByModule.get(m.id)}
                  onOpenPicker={() => setPickerModuleId(m.id)}
                  onOpenDoc={(docId) => open({ docId, start: 0, end: 0 })}
                />
              ))}
            </div>

            <RunNotesPad
              value={runNotes}
              onChange={setRunNotes}
              hint={
                phase === "done"
                  ? "Saved when you leave this window"
                  : phase === "running"
                    ? "Add notes while the run finishes"
                    : "Describe what you're testing before you run"
              }
            />

            {insufficientCredit && phase !== "running" ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-5 text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
                <p className="mt-3 text-sm font-medium text-destructive">
                  Not enough credit to run a pipeline
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  Balance ${(billingAccount!.balanceCents / 100).toFixed(2)} ·{" "}
                  ${(minRunBalanceCents / 100).toFixed(2)} minimum to run
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
                !allInputsReady ||
                inputsInvalid ||
                validatingInputs ||
                phase === "running" ||
                insufficientCredit
              }
              onClick={
                configAlreadyCompleted && cachedLoggingRunId
                  ? () => openLogging(cachedLoggingRunId)
                  : start
              }
            >
              {phase === "running" ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : configAlreadyCompleted ? (
                <ScrollText className="mr-1.5 h-4 w-4" />
              ) : (
                <Zap className="mr-1.5 h-4 w-4" />
              )}
              {phase === "running"
                ? `${waitPhrase}…`
                : configAlreadyCompleted
                  ? "View cached run in Logging"
                  : "Run pipeline"}
            </Button>

            {configAlreadyCompleted && (
              <p className="text-center font-mono text-[10px] text-muted-foreground">
                Identical pipeline and inputs — no compute needed. Change an input or edit the pipeline to run again.
              </p>
            )}
            </>
            )}

            {inputsInvalid && !validatingInputs && (
              <ErrorBanner text={inferenceInputIssueMessage(inputIssues)} />
            )}

            {error && phase !== "done" && <ErrorBanner text={error} />}

            {phase === "running" && (
              <div className="rounded-lg border border-border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    progress
                  </span>
                  <span className="font-mono text-[11px] text-primary">{progressPct}%</span>
                </div>
                <Progress value={progressPct} className="h-1.5" />
                <CyclingWaitPhrase phrase={waitPhrase} className="mt-3" />
                <div className="mt-4 space-y-2.5">
                  {segmentPipeline(modules).map((seg) => {
                    if (seg.kind === "combine") {
                      const combineUi = stepStates.get(seg.combine.id)
                      const inputUi = stepStates.get(seg.input.id)
                      const combineState = combineUi?.status ?? "idle"
                      const inputState = inputUi?.status ?? "idle"
                      const state =
                        combineState === "error" || inputState === "error"
                          ? "error"
                          : combineState === "running" || inputState === "running"
                            ? "running"
                            : combineState === "cached" && inputState === "cached"
                              ? "cached"
                              : combineState !== "idle" || inputState !== "idle"
                                ? "ok"
                                : "idle"
                      return (
                        <div key={seg.combine.id} className="space-y-1">
                          <StepRow
                            label={seg.combine.label}
                            state={state}
                            sub={combineUi?.sub}
                          />
                          <StepRow
                            label={seg.input.label}
                            state={inputState}
                            sub={inputUi?.sub}
                            nested
                          />
                        </div>
                      )
                    }
                    const moduleUi = stepStates.get(seg.module.id)
                    const moduleState = moduleUi?.status ?? "idle"
                    return (
                      <StepRow
                        key={seg.module.id}
                        label={seg.module.label}
                        state={moduleState}
                        sub={moduleUi?.sub}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {debugLogs.length > 0 && (
              <div className="rounded-lg border border-border">
                <div className="border-b border-border px-3 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    server logs · live
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto p-2 font-mono text-[10px] leading-relaxed">
                  {debugLogs.map((l, i) => (
                    <div
                      key={`${l.at}-${i}`}
                      className={cn(
                        "whitespace-pre-wrap break-words",
                        l.level === "error" && "text-destructive",
                        l.level === "warn" && "text-yellow-500",
                        l.level === "debug" && "text-muted-foreground",
                        l.level === "info" && "text-foreground/80",
                      )}
                    >
                      {l.line}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            )}

            {run && phase === "done" && (
              <div className="rounded-lg border border-border bg-card px-6 py-8 text-center">
                {dedupedRunId ? (
                  <Zap className="mx-auto h-10 w-10 text-primary" />
                ) : run.status === "ok" ? (
                  <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
                ) : (
                  <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
                )}
                <p className="mt-4 text-sm font-medium">
                  {dedupedRunId
                    ? "Identical run already completed"
                    : run.status === "ok"
                      ? "Pipeline finished"
                      : "Pipeline finished with errors"}
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {dedupedRunId
                    ? "Pipeline and inputs match a previous run — no compute was used."
                    : "Output, step traces, and costs are in Logging."}
                </p>
                {runErr && (
                  <div className="mt-4 text-left">
                    <ErrorBanner text={runErr} />
                  </div>
                )}
                <Button className="mt-5 gap-1.5" onClick={() => openLogging(dedupedRunId ?? run.id)}>
                  <ScrollText className="h-3.5 w-3.5" />
                  {dedupedRunId ? "View cached run in Logging" : "Go to logging"}
                </Button>
              </div>
            )}
          </div>
      </div>
      )}
      {pickerModule && (
        <InferenceInputPickerPopup
          inputModule={pickerModule}
          selectedDocId={inputDocs[pickerModule.id]?.id}
          onSelect={(doc) => setInputDocForModule(pickerModule.id, doc)}
          onClose={() => setPickerModuleId(null)}
        />
      )}
    </div>
  )
}

function InferenceInputSlot({
  inputModule,
  outModel,
  doc,
  issue,
  onOpenPicker,
  onOpenDoc,
}: {
  inputModule: PipelineModule
  outModel?: string
  doc?: DocRef
  issue?: InferenceInputIssue
  onOpenPicker: () => void
  onOpenDoc: (docId: DocId) => void
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-3", issue ? "border-destructive/50" : "border-border")}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium">{inputModule.label}</span>
        <Badge variant="outline" className="font-mono text-[9px] capitalize">
          {inputTypeLabel(inputModule.inputType)}
        </Badge>
        {inputNameRestrictionLabel(inputModule) && (
          <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
            name ∋ "{inputNameRestrictionLabel(inputModule)}"
          </Badge>
        )}
        {outModel && (
          <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
            → {outModel}
          </Badge>
        )}
      </div>
      {doc ? (
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="outline" size="sm" className="h-8 bg-transparent" onClick={onOpenPicker}>
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Change
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={onOpenPicker}>
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Choose from store
        </Button>
      )}
      {issue && (
        <p className="mt-2 font-mono text-[10px] text-destructive">
          {issue.message}
        </p>
      )}
    </div>
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

  async function copyError() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
}: {
  label: string
  state: StepProgress["status"] | "idle"
  nested?: boolean
  sub?: StepSubProgress
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
    </div>
  )
}
