"use client"

import { invariant } from "@/lib/assert"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  flattenInputDocIds,
  inputDocsByModuleFromAssignment,
  type InputDocsAssignment,
} from "@/lib/inference-input"
import { logsByModuleFromRun, partitionLogsByModule } from "@/lib/step-logs"
import { useRunProgressUi } from "@/lib/use-run-progress-ui"
import { readAllowDuplicateRuns } from "@/lib/inference-settings"
import {
  awaitRun,
  isRunBillingError,
  mergeStepStates,
  startRun,
  type StepUiState,
} from "@/lib/run-engine"
import { isPreviewOnly } from "@/lib/demo-mode"
import { useRunNotesFlushOnLeave } from "@/lib/run-notes-flush"
import type { DocId, JobLogEntry, ModuleId, PipelineModule, PipelineRun, ProjectId, RunJobId } from "@/lib/types"
import type { ClientStepSpec } from "@/lib/run-types"

export type InferencePhase = "idle" | "running" | "done"

type UseInferenceRunProgressArgs = {
  projectId: ProjectId
  modules: PipelineModule[]
  model: string
  configResetKey?: string
  inputModules: PipelineModule[]
  inputDocs: InputDocsAssignment
  allInputsReady: boolean
  inputsInvalid: boolean
  runs: PipelineRun[]
  addRun: (r: PipelineRun) => void
  updateRunNotes: (runId: PipelineRun["id"], notes: string | undefined) => Promise<void>
  refreshBilling: () => Promise<void>
  resetInputs?: () => void
  flushPendingSave?: () => Promise<void>
}

export function useInferenceRunProgress({
  projectId,
  modules,
  model,
  configResetKey,
  inputModules,
  inputDocs,
  allInputsReady,
  inputsInvalid,
  runs,
  addRun,
  updateRunNotes,
  refreshBilling,
  resetInputs,
  flushPendingSave,
}: UseInferenceRunProgressArgs) {
  const [phase, setPhase] = useState<InferencePhase>("idle")
  const [stepStates, setStepStates] = useState<Map<ModuleId, StepUiState>>(new Map())
  const [run, setRun] = useState<PipelineRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugLogs, setDebugLogs] = useState<JobLogEntry[]>([])
  const [runNotes, setRunNotes] = useState("")
  const [pendingHumanReview, setPendingHumanReview] = useState<ClientStepSpec | null>(null)
  const [deduped, setDeduped] = useState(false)
  const humanReviewResolveRef = useRef<((decision: "approved" | "rejected") => void) | null>(null)
  const runNotesRef = useRef("")
  const savedNotesRef = useRef<string | undefined>(undefined)
  const logEndRef = useRef<HTMLDivElement>(null)
  const activeJobGenRef = useRef(0)
  const activeJobIdRef = useRef<RunJobId | null>(null)
  const configChangedDuringRunRef = useRef(false)
  const runsRef = useRef(runs)
  runsRef.current = runs

  useEffect(() => {
    runNotesRef.current = runNotes
  }, [runNotes])

  useEffect(() => {
    if (phase !== "running") return
    logEndRef.current?.scrollIntoView({ behavior: "auto" })
  }, [debugLogs.length, phase])

  useEffect(() => {
    return () => {
      activeJobGenRef.current++
    }
  }, [])

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

  function resetRunState() {
    activeJobGenRef.current++
    activeJobIdRef.current = null
    setPhase("idle")
    setStepStates(new Map())
    setRun(null)
    setError(null)
    setDebugLogs([])
    setRunNotes("")
    setPendingHumanReview(null)
    setDeduped(false)
    humanReviewResolveRef.current = null
    savedNotesRef.current = undefined
    resetInputs?.()
  }

  // AI : drop stale step trace when pipeline/structure/input config changes (not on project switch — handled separately).
  const prevConfigKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!configResetKey) return
    if (prevConfigKeyRef.current === null) {
      prevConfigKeyRef.current = configResetKey
      return
    }
    if (prevConfigKeyRef.current === configResetKey) return
    if (phase === "running") {
      configChangedDuringRunRef.current = true
      prevConfigKeyRef.current = configResetKey
      return
    }
    prevConfigKeyRef.current = configResetKey
    resetRunState()
  }, [configResetKey, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "done" || !configChangedDuringRunRef.current) return
    configChangedDuringRunRef.current = false
    resetRunState()
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    if (isPreviewOnly()) return
    if (!allInputsReady || inputsInvalid) return
    const jobGen = ++activeJobGenRef.current
    const orderedIds = flattenInputDocIds(inputModules, inputDocs)
    const byModule = inputDocsByModuleFromAssignment(inputModules, inputDocs)
    const [primary, ...rest] = orderedIds
    invariant(primary, "start() called without primary input doc despite allInputsReady")
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
      // AI : flush any debounced project save before starting — prevents stale server state causing 400.
      await flushPendingSave?.()
      const { jobId } = await startRun(
        projectId,
        primary,
        model,
        rest,
        byModule,
        readAllowDuplicateRuns(),
      )
      if (jobGen !== activeJobGenRef.current) return
      activeJobIdRef.current = jobId
      refreshBilling().catch(console.error)
      const { run: finished, deduped } = await awaitRun(jobId, {
        onStep: (steps) => {
          if (jobGen !== activeJobGenRef.current || activeJobIdRef.current !== jobId) return
          setStepStates((prev) => mergeStepStates(prev, steps))
        },
        onLogs: (logs) => {
          if (jobGen !== activeJobGenRef.current || activeJobIdRef.current !== jobId) return
          setDebugLogs(logs)
        },
        onHumanReview: (spec) => {
          if (jobGen !== activeJobGenRef.current) {
            return Promise.resolve("rejected" as const)
          }
          setPendingHumanReview(spec)
          return new Promise<"approved" | "rejected">((resolve) => {
            humanReviewResolveRef.current = resolve
          })
        },
      })
      if (jobGen !== activeJobGenRef.current) return
      const notes = runNotesRef.current.trim() || undefined
      const withNotes = notes ? { ...finished, notes } : finished
      savedNotesRef.current = notes
      setRun(withNotes)
      setDeduped(!!deduped)
      if (!runsRef.current.some((r) => r.id === finished.id)) {
        addRun(withNotes)
      }
      if (notes) updateRunNotes(finished.id, notes).catch(console.error)
      setPhase("done")
    } catch (e) {
      if (jobGen !== activeJobGenRef.current) return
      if (isRunBillingError(e)) refreshBilling().catch(console.error)
      setError((e as Error).message)
      setPhase("idle")
    }
  }

  function resolveHumanReview(decision: "approved" | "rejected") {
    humanReviewResolveRef.current?.(decision)
    humanReviewResolveRef.current = null
    setPendingHumanReview(null)
  }

  function reset() {
    resetRunState()
  }

  const {
    progressPct,
    waitPhrase,
    runErr,
    runErrorDisplay,
    runButtonBusy,
    runButtonLabel,
  } = useRunProgressUi({ modules, phase, stepStates, run, pendingHumanReview })

  const activeModuleId = useMemo(() => {
    for (const m of modules) {
      if (stepStates.get(m.id)?.status === "running") return m.id
    }
    return undefined
  }, [stepStates, modules])
  const moduleIds = useMemo(() => modules.map((m) => m.id), [modules])
  const logsByModule = useMemo(() => {
    if (phase === "done" && run) {
      const fromRun = logsByModuleFromRun(run, moduleIds)
      if ([...fromRun.values()].some((logs) => logs.length > 0)) return fromRun
    }
    return partitionLogsByModule(debugLogs, moduleIds, activeModuleId)
  }, [phase, run, debugLogs, moduleIds, activeModuleId])

  return {
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
    pendingHumanReview,
    deduped,
    resolveHumanReview,
    start,
    reset,
    resetRunState,
  }
}
