"use client"

// AI : TODO refactor — split into useInferenceDocs, useRunProgress;
// AI : keep inference.tsx mostly layout.
import { useEffect, useMemo, useRef, useState } from "react"
import {
  buildDefaultInputDocs,
  inputDocIdsForModules,
  inputDocsByModuleFromAssignment,
  orderedInputModules,
  resolveInputDocs,
  moduleInputReady,
  docsForInputModule,
  flattenInputDocIds,
  isMultiDocInputModule,
  type InputDocsAssignment,
} from "@/lib/inference-input"
import {
  collectInferenceInputIssues,
  type InferenceInputIssue,
} from "@/lib/inference-validity"
import { segmentPipeline } from "@/lib/pipeline-layout"
import { formatRunErrorForDisplay, pipelineRunError } from "@/lib/run-errors"
import { partitionLogsByModule } from "@/lib/step-logs"
import { useCyclingWaitPhrase } from "@/lib/inference-wait-phrases"
import { useRunNotesFlushOnLeave } from "@/lib/run-notes-flush"
import {
  awaitRun,
  isRunBillingError,
  mergeStepStates,
  startRun,
  type JobLogEntry,
  type StepUiState,
} from "@/lib/run-engine"
import { defaultInferenceDoc } from "@/lib/project-docs"
import type { DocId, DocRef, ModelId, ModuleId, PipelineModule, PipelineRun, Project, ProjectId } from "@/lib/types"

export type InferencePhase = "idle" | "running" | "done"

type UseInferenceRunArgs = {
  project: Project
  modules: PipelineModule[]
  model: string
  docs: DocRef[]
  runs: PipelineRun[]
  inferenceInputDocIds: Partial<Record<ModuleId, DocId | DocId[]>>
  setInferenceInputDocIds: (docs: Partial<Record<ModuleId, DocId | DocId[]>>) => void
  addRun: (r: PipelineRun) => void
  updateRunNotes: (runId: PipelineRun["id"], notes: string | undefined) => Promise<void>
  refreshBilling: () => Promise<void>
}

export function useInferenceRun({
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
}: UseInferenceRunArgs) {
  const [inputDocs, setInputDocs] = useState<InputDocsAssignment>({})
  const [inputIssues, setInputIssues] = useState<InferenceInputIssue[]>([])
  const [pickerModuleId, setPickerModuleId] = useState<ModuleId | null>(null)
  const [phase, setPhase] = useState<InferencePhase>("idle")
  const [stepStates, setStepStates] = useState<Map<ModuleId, StepUiState>>(new Map())
  const [run, setRun] = useState<PipelineRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugLogs, setDebugLogs] = useState<JobLogEntry[]>([])
  const [runNotes, setRunNotes] = useState("")
  const runNotesRef = useRef("")
  const savedNotesRef = useRef<string | undefined>(undefined)
  const logEndRef = useRef<HTMLDivElement>(null)
  const prevProjectIdRef = useRef<ProjectId | null>(null)
  const activeJobGenRef = useRef(0)

  useEffect(() => {
    runNotesRef.current = runNotes
  }, [runNotes])

  const inputModules = useMemo(() => orderedInputModules(modules), [modules])
  const pickerModule = pickerModuleId ? inputModules.find((m) => m.id === pickerModuleId) : undefined
  const allInputsReady = inputModules.every((m) => moduleInputReady(m, inputDocs))
  const inputsInvalid = inputIssues.length > 0
  const inputIssueByModule = useMemo(
    () => new Map(inputIssues.map((issue) => [issue.moduleId, issue])),
    [inputIssues],
  )

  const inputDocIdsKey = inputModules
    .map((m) => docsForInputModule(inputDocs, m.id).map((d) => d.id).join("+"))
    .join(",")

  const runsRef = useRef(runs)
  runsRef.current = runs

  useEffect(() => {
    if (!allInputsReady) {
      setInputIssues([])
      return
    }
    setInputIssues(collectInferenceInputIssues(inputModules, {}, {}, inputDocs))
  }, [allInputsReady, inputModules, inputDocs, inputDocIdsKey])

  useEffect(() => {
    if (!allInputsReady) return
    const ids = Object.fromEntries(
      inputModules
        .filter((m) => moduleInputReady(m, inputDocs))
        .map((m) => {
          const moduleDocs = docsForInputModule(inputDocs, m.id)
          const docIds = moduleDocs.map((d) => d.id as DocId)
          return [m.id, isMultiDocInputModule(m) ? docIds : docIds[0]!] as const
        }),
    ) as Partial<Record<ModuleId, DocId | DocId[]>>
    const unchanged = inputModules.every((m) => {
      const saved = inferenceInputDocIds[m.id]
      const moduleDocIds = docsForInputModule(inputDocs, m.id).map((d) => d.id)
      if (Array.isArray(saved)) return saved.length === moduleDocIds.length && saved.every((id, i) => id === moduleDocIds[i])
      return saved === moduleDocIds[0]
    })
    if (unchanged) return
    setInferenceInputDocIds(ids)
  }, [inputDocIdsKey, allInputsReady, inferenceInputDocIds, setInferenceInputDocIds, inputModules, inputDocs])

  useEffect(() => {
    const switched = prevProjectIdRef.current != null && prevProjectIdRef.current !== project.id
    prevProjectIdRef.current = project.id as ProjectId
    setInputDocs(
      resolveInputDocs(docs, project, inputModules, inferenceInputDocIds, defaultInferenceDoc(docs, project)),
    )
    if (switched) {
      activeJobGenRef.current++
      setPhase("idle")
      setStepStates(new Map())
      setRun(null)
      setError(null)
      setDebugLogs([])
      setRunNotes("")
      savedNotesRef.current = undefined
      setInputIssues([])
      setPickerModuleId(null)
    }
  }, [project.id, docs, inputModules, inferenceInputDocIds, project])

  useEffect(() => {
    return () => {
      activeJobGenRef.current++
    }
  }, [])

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
    const mod = inputModules.find((m) => m.id === moduleId)
    setInputDocs((prev) => {
      if (mod && isMultiDocInputModule(mod)) {
        const current = docsForInputModule(prev, moduleId)
        const next = current.some((d) => d.id === doc.id) ? current : [...current, doc]
        return { ...prev, [moduleId]: next }
      }
      return { ...prev, [moduleId]: doc }
    })
    setPickerModuleId(null)
  }

  function removeInputDocForModule(moduleId: ModuleId, docId: DocId) {
    setInputDocs((prev) => {
      const mod = inputModules.find((m) => m.id === moduleId)
      if (!mod || !isMultiDocInputModule(mod)) {
        const next = { ...prev }
        delete next[moduleId]
        return next
      }
      const filtered = docsForInputModule(prev, moduleId).filter((d) => d.id !== docId)
      if (!filtered.length) {
        const next = { ...prev }
        delete next[moduleId]
        return next
      }
      return { ...prev, [moduleId]: filtered }
    })
  }

  function useSamples() {
    setInputDocs(buildDefaultInputDocs(docs, project, inputModules, defaultInferenceDoc(docs, project)))
  }

  async function start() {
    if (!allInputsReady || inputsInvalid) return
    const jobGen = ++activeJobGenRef.current
    const orderedIds = flattenInputDocIds(inputModules, inputDocs)
    const byModule = inputDocsByModuleFromAssignment(inputModules, inputDocs)
    const [primary, ...rest] = orderedIds
    if (phase === "done") {
      setRunNotes("")
      runNotesRef.current = ""
    }
    setPhase("running")
    setError(null)
    setRun(null)
    setStepStates(new Map())
    setDebugLogs([])
    try {
      const { jobId } = await startRun(project.id as ProjectId, primary, model, rest, byModule)
      if (jobGen !== activeJobGenRef.current) return
      refreshBilling().catch(console.error)
      const { run: finished } = await awaitRun(jobId, {
        onStep: (steps) => {
          if (jobGen !== activeJobGenRef.current) return
          setStepStates((prev) => mergeStepStates(prev, steps))
        },
        onLogs: (logs) => {
          if (jobGen !== activeJobGenRef.current) return
          setDebugLogs(logs)
        },
      })
      if (jobGen !== activeJobGenRef.current) return
      const notes = runNotesRef.current.trim() || undefined
      const withNotes = notes ? { ...finished, notes } : finished
      savedNotesRef.current = notes
      setRun(withNotes)
      if (!runsRef.current.some((r) => r.id === finished.id)) {
        addRun(withNotes)
      }
      if (notes) updateRunNotes(finished.id, notes).catch(console.error)
      const runErr = pipelineRunError(finished)
      if (runErr) setError(runErr)
      setPhase("done")
    } catch (e) {
      if (jobGen !== activeJobGenRef.current) return
      if (isRunBillingError(e)) refreshBilling().catch(console.error)
      setError((e as Error).message)
      setPhase("idle")
    }
  }

  function reset() {
    setPhase("idle")
    setStepStates(new Map())
    setRun(null)
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
  const runErrorDisplay = useMemo(() => (run ? formatRunErrorForDisplay(run) : null), [run])
  const activeModuleId = useMemo(() => {
    for (const m of modules) {
      if (stepStates.get(m.id)?.status === "running") return m.id
    }
    return undefined
  }, [stepStates, modules])
  const logsByModule = useMemo(
    () => partitionLogsByModule(debugLogs, modules.map((m) => m.id), activeModuleId),
    [debugLogs, modules, activeModuleId],
  )
  const runButtonBusy = phase === "running"
  const runButtonLabel = phase === "running" ? `${waitPhrase}…` : "Run pipeline"

  return {
    inputDocs,
    inputIssues,
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
    error,
    debugLogs,
    logsByModule,
    runNotes,
    setRunNotes,
    logEndRef,
    runErr,
    runErrorDisplay,
    runButtonBusy,
    runButtonLabel,
    progressPct,
    waitPhrase,
    setInputDocForModule,
    removeInputDocForModule,
    useSamples,
    start,
    reset,
  }
}
