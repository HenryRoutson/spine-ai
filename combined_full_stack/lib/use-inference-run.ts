"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { apiText } from "@/lib/api-client"
import { defaultInferenceDoc } from "@/lib/project-docs"
import {
  buildDefaultInputDocs,
  docMatchesInputModule,
  inputDocIdsForModules,
  orderedInputModules,
  resolveInputDocs,
} from "@/lib/inference-input"
import {
  collectInferenceInputIssues,
  type InferenceInputIssue,
} from "@/lib/inference-validity"
import { segmentPipeline } from "@/lib/pipeline-layout"
import { useCyclingWaitPhrase } from "@/lib/inference-wait-phrases"
import { useRunNotesFlushOnLeave } from "@/lib/run-notes-flush"
import {
  awaitRun,
  isRunBillingError,
  matchRun,
  mergeStepStates,
  startRun,
  type JobLogEntry,
  type StepUiState,
} from "@/lib/run-engine"
import type { DocId, DocRef, ModuleId, PipelineModule, PipelineRun, Project, ProjectId } from "@/lib/types"

export type InferencePhase = "idle" | "running" | "done"

// AI : step errors live on RunStep.outputPreview — surface them instead of a generic "run error".
export function pipelineRunError(run: PipelineRun): string | null {
  const step = run.steps.find((s) => s.status === "error")
  if (!step) return run.status === "error" ? "Pipeline failed" : null
  return step.outputPreview ? `${step.label}: ${step.outputPreview}` : `${step.label} failed`
}

type UseInferenceRunArgs = {
  project: Project
  modules: PipelineModule[]
  model: string
  docs: DocRef[]
  inferenceInputDocIds: Partial<Record<ModuleId, DocId>>
  setInferenceInputDocIds: (docs: Partial<Record<ModuleId, DocId>>) => void
  addRun: (r: PipelineRun) => void
  updateRunNotes: (runId: PipelineRun["id"], notes: string | undefined) => Promise<void>
  refreshBilling: () => Promise<void>
}

export function useInferenceRun({
  project,
  modules,
  model,
  docs,
  inferenceInputDocIds,
  setInferenceInputDocIds,
  addRun,
  updateRunNotes,
  refreshBilling,
}: UseInferenceRunArgs) {
  const [inputDocs, setInputDocs] = useState<Partial<Record<ModuleId, DocRef>>>({})
  const [inputIssues, setInputIssues] = useState<InferenceInputIssue[]>([])
  const [validatingInputs, setValidatingInputs] = useState(false)
  const [probingCache, setProbingCache] = useState(false)
  const [pickerModuleId, setPickerModuleId] = useState<ModuleId | null>(null)
  const [phase, setPhase] = useState<InferencePhase>("idle")
  const [stepStates, setStepStates] = useState<Map<ModuleId, StepUiState>>(new Map())
  const [run, setRun] = useState<PipelineRun | null>(null)
  const [cachedRunId, setCachedRunId] = useState<string | null>(null)
  const [wasDeduped, setWasDeduped] = useState(false)
  const [dbFingerprint, setDbFingerprint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugLogs, setDebugLogs] = useState<JobLogEntry[]>([])
  const [runNotes, setRunNotes] = useState("")
  const runNotesRef = useRef("")
  const savedNotesRef = useRef<string | undefined>(undefined)
  const logEndRef = useRef<HTMLDivElement>(null)
  const prevProjectIdRef = useRef<ProjectId | null>(null)
  const confirmedProbeKeyRef = useRef<string | null>(null)

  useEffect(() => {
    runNotesRef.current = runNotes
  }, [runNotes])

  const inputModules = useMemo(() => orderedInputModules(modules), [modules])
  const pickerModule = pickerModuleId ? inputModules.find((m) => m.id === pickerModuleId) : undefined
  const allInputsReady = inputModules.every((m) => inputDocs[m.id])
  const inputsInvalid = inputIssues.length > 0
  const inputIssueByModule = useMemo(
    () => new Map(inputIssues.map((issue) => [issue.moduleId, issue])),
    [inputIssues],
  )
  const configAlreadyCompleted = phase === "done" && run?.status === "ok" && cachedRunId != null
  const loggingRunId = cachedRunId ?? run?.id

  const inputDocIdsKey = inputModules.map((m) => inputDocs[m.id]?.id ?? "").join(",")
  const moduleIdsKey = modules.map((m) => m.id).join(",")
  const probeKey = `${project.id}:${model}:${inputDocIdsKey}:${moduleIdsKey}`

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const inputModulesRef = useRef(inputModules)
  inputModulesRef.current = inputModules
  const inputDocsRef = useRef(inputDocs)
  inputDocsRef.current = inputDocs
  const prevProbeKeyRef = useRef(probeKey)

  useEffect(() => {
    if (!allInputsReady || phaseRef.current === "running") return
    if (prevProbeKeyRef.current !== probeKey) {
      prevProbeKeyRef.current = probeKey
      confirmedProbeKeyRef.current = null
    }
    if (confirmedProbeKeyRef.current === probeKey) return

    let cancelled = false
    async function probeDbMatch() {
      setProbingCache(true)
      const inputMods = inputModulesRef.current
      const docsByModule = inputDocsRef.current
      const orderedIds = inputDocIdsForModules(inputMods, docsByModule)
      const [primary, ...rest] = orderedIds
      try {
        const { fingerprint, cachedRunId: matchedId, run: matchedRun } = await matchRun(
          project.id as ProjectId,
          primary,
          model,
          rest,
        )
        if (cancelled) return
        setDbFingerprint(fingerprint)
        if (matchedId && matchedRun?.status === "ok") {
          confirmedProbeKeyRef.current = probeKey
          setRun(matchedRun)
          setCachedRunId(matchedId)
          setWasDeduped(true)
          setPhase("done")
          return
        }
        confirmedProbeKeyRef.current = null
        setCachedRunId(null)
        setWasDeduped(false)
        setPhase("idle")
        setRun(null)
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setProbingCache(false)
      }
    }
    void probeDbMatch()
    return () => {
      cancelled = true
    }
  }, [probeKey, allInputsReady, project.id, model])

  useEffect(() => {
    if (!allInputsReady) return
    const ids = Object.fromEntries(
      inputModules.filter((m) => inputDocs[m.id]).map((m) => [m.id, inputDocs[m.id]!.id as DocId]),
    ) as Partial<Record<ModuleId, DocId>>
    const unchanged = inputModules.every((m) => inferenceInputDocIds[m.id] === ids[m.id])
    if (unchanged) return
    setInferenceInputDocIds(ids)
  }, [probeKey, allInputsReady, inferenceInputDocIds, setInferenceInputDocIds, inputModules, inputDocs])

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
            try {
              contentByDocId[doc.id] = await apiText(`/api/docs/${doc.id}/text`)
            } catch {
              // AI : dev HMR / tab churn can abort fetches — treat as missing content for validation.
            }
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
  }, [probeKey, inputModules, inputDocs])

  useEffect(() => {
    const switched = prevProjectIdRef.current != null && prevProjectIdRef.current !== project.id
    prevProjectIdRef.current = project.id as ProjectId
    setInputDocs(
      resolveInputDocs(docs, project, inputModules, inferenceInputDocIds, defaultInferenceDoc(docs, project)),
    )
    setInputIssues([])
    setPickerModuleId(null)
    if (switched) {
      confirmedProbeKeyRef.current = null
      setPhase("idle")
      setStepStates(new Map())
      setRun(null)
      setCachedRunId(null)
      setWasDeduped(false)
      setDbFingerprint(null)
      setProbingCache(false)
      setError(null)
      setDebugLogs([])
      setRunNotes("")
      savedNotesRef.current = undefined
    }
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
    setInputDocs(buildDefaultInputDocs(docs, project, inputModules, defaultInferenceDoc(docs, project)))
  }

  async function start() {
    if (!allInputsReady || inputsInvalid) return
    const orderedIds = inputModules.map((m) => inputDocs[m.id]!.id as DocId)
    const [primary, ...rest] = orderedIds
    if (phase === "done") {
      setRunNotes("")
      runNotesRef.current = ""
    }
    confirmedProbeKeyRef.current = null
    setPhase("running")
    setError(null)
    setRun(null)
    setCachedRunId(null)
    setWasDeduped(false)
    setStepStates(new Map())
    setDebugLogs([])
    try {
      const { jobId } = await startRun(project.id as ProjectId, primary, model, rest)
      refreshBilling().catch(console.error)
      const { run: finished, deduped, cachedRunId: matchedCachedId } = await awaitRun(jobId, {
        onStep: (steps) => setStepStates((prev) => mergeStepStates(prev, steps)),
        onLogs: (logs) => setDebugLogs(logs),
      })
      const notes = runNotesRef.current.trim() || undefined
      const withNotes = notes ? { ...finished, notes } : finished
      savedNotesRef.current = notes
      setRun(withNotes)
      const logId = deduped ? (matchedCachedId ?? finished.id) : finished.id
      setCachedRunId(finished.status === "ok" ? logId : null)
      setWasDeduped(deduped ?? false)
      if (finished.status === "ok") {
        confirmedProbeKeyRef.current = probeKey
        const ids = inputDocIdsForModules(inputModules, inputDocs)
        const [p, ...r] = ids
        matchRun(project.id as ProjectId, p, model, r)
          .then(({ fingerprint }) => setDbFingerprint(fingerprint))
          .catch(console.error)
      }
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
    confirmedProbeKeyRef.current = null
    setPhase("idle")
    setStepStates(new Map())
    setRun(null)
    setCachedRunId(null)
    setWasDeduped(false)
    setDbFingerprint(null)
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
  }, [phase, stepStates, modules])

  const runningHints = useMemo(() => {
    const hints: string[] = []
    for (const seg of segmentPipeline(modules)) {
      if (seg.kind === "combine") {
        const combineUi = stepStates.get(seg.combine.id)
        const inputUi = stepStates.get(seg.input.id)
        if (combineUi?.status === "running") hints.push(combineUi.sub?.label ?? seg.combine.label)
        if (inputUi?.status === "running") hints.push(inputUi.sub?.label ?? seg.input.label)
        continue
      }
      const moduleUi = stepStates.get(seg.module.id)
      if (moduleUi?.status === "running") hints.push(moduleUi.sub?.label ?? seg.module.label)
    }
    return hints
  }, [stepStates, modules])

  const waitPhrase = useCyclingWaitPhrase(phase === "running", runningHints)
  const runErr = useMemo(() => (run ? pipelineRunError(run) : null), [run])
  const runButtonBusy = phase === "running" || validatingInputs || probingCache
  const runButtonLabel =
    phase === "running"
      ? `${waitPhrase}…`
      : validatingInputs
        ? "Validating inputs…"
        : probingCache
          ? "Checking for cached run…"
          : configAlreadyCompleted
            ? "View cached run in Logging"
            : "Run pipeline"

  return {
    inputDocs,
    inputIssues,
    validatingInputs,
    probingCache,
    pickerModuleId,
    setPickerModuleId,
    pickerModule,
    inputModules,
    allInputsReady,
    inputsInvalid,
    inputIssueByModule,
    phase,
    stepStates,
    run,
    cachedRunId,
    wasDeduped,
    dbFingerprint,
    error,
    debugLogs,
    runNotes,
    setRunNotes,
    logEndRef,
    configAlreadyCompleted,
    loggingRunId,
    runErr,
    runButtonBusy,
    runButtonLabel,
    progressPct,
    waitPhrase,
    setInputDocForModule,
    useSamples,
    start,
    reset,
  }
}
