"use client"

import type { AccountRefreshOpts } from "@/lib/store"
import { invariant } from "@/lib/assert"
import { useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
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
  RunStartError,
  type StepUiState,
} from "@/lib/run-engine"
import { isPreviewOnly } from "@/lib/demo-mode"
import { useRunNotesFlushOnLeave } from "@/lib/run-notes-flush"
import { useRunJobs } from "@/lib/run-jobs-context"
import { activeStepLabelFromStepStates, progressPctFromStepStates } from "@/lib/run-jobs-progress"
import { isRunAbortedError, useCancellableRun } from "@/lib/use-cancellable-run"
import type { DocId, JobLogEntry, ModuleId, PipelineModule, PipelineRun, ProjectId, RunJobId } from "@/lib/types"
import type { ClientStepSpec } from "@/lib/run-types"
import type { CodeExecUiState } from "@/lib/code-exec-ui"
import { buildChatbotResult, type ChatbotResultValue } from "@/lib/chatbot-step"
import { RunJobSource } from "@/lib/run-jobs-types"
import { RunPhase } from "@/lib/run-phase"

export { RunPhase as InferencePhase } from "@/lib/run-phase"

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
  refreshBilling: (opts?: AccountRefreshOpts) => Promise<void>
  resetInputs?: () => void
  flushPendingSave?: () => Promise<void>
  onProjectNotFound?: (projectId: ProjectId) => void
  projectLlmProviders?: import("@/lib/custom-llm-providers").CustomLlmProviderDef[]
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
  onProjectNotFound,
  projectLlmProviders,
}: UseInferenceRunProgressArgs) {
  const [phase, setPhase] = useState<RunPhase>(RunPhase.Idle)
  const [stepStates, setStepStates] = useState<Map<ModuleId, StepUiState>>(new Map())
  const [run, setRun] = useState<PipelineRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugLogs, setDebugLogs] = useState<JobLogEntry[]>([])
  const [codeExecByModule, setCodeExecByModule] = useState<Map<ModuleId, CodeExecUiState>>(new Map())
  const [runNotes, setRunNotes] = useState("")
  const [pendingHumanReview, setPendingHumanReview] = useState<ClientStepSpec | null>(null)
  const [pendingChatbot, setPendingChatbot] = useState<ClientStepSpec | null>(null)
  const [activeJobId, setActiveJobId] = useState<RunJobId | null>(null)
  const [deduped, setDeduped] = useState(false)
  const humanReviewResolveRef = useRef<((decision: "approved" | "rejected") => void) | null>(null)
  const chatbotResolveRef = useRef<((result: import("@/lib/chatbot-step").ChatbotResultValue) => void) | null>(null)
  const runNotesRef = useRef("")
  const savedNotesRef = useRef<string | undefined>(undefined)
  const logEndRef = useRef<HTMLDivElement>(null)
  const activeJobGenRef = useRef(0)
  const activeJobIdRef = useRef<RunJobId | null>(null)
  const activeTrackIdRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const stepStatesRef = useRef<Map<ModuleId, StepUiState>>(new Map())
  const runsRef = useRef(runs)
  runsRef.current = runs
  const runJobs = useRunJobs()
  const cancellable = useCancellableRun()

  useEffect(() => {
    runNotesRef.current = runNotes
  }, [runNotes])

  useEffect(() => {
    if (phase !== RunPhase.Running) return
    logEndRef.current?.scrollIntoView({ behavior: "auto" })
  }, [debugLogs.length, phase])

  useEffect(() => {
    stepStatesRef.current = stepStates
  }, [stepStates])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [projectId])

  useRunNotesFlushOnLeave(
    phase === RunPhase.Done ? run?.id : undefined,
    runNotes,
    run?.notes,
    updateRunNotes,
    (id, next) => {
      savedNotesRef.current = next
      setRun((r) => (r?.id === id ? { ...r, notes: next } : r))
    },
  )

  function clearRunUiState() {
    setPhase(RunPhase.Idle)
    setStepStates(new Map())
    stepStatesRef.current = new Map()
    setRun(null)
    setError(null)
    setDebugLogs([])
    setCodeExecByModule(new Map())
    setPendingHumanReview(null)
    setPendingChatbot(null)
    setActiveJobId(null)
    setDeduped(false)
    humanReviewResolveRef.current = null
    chatbotResolveRef.current = null
  }

  // AI : orphan local callbacks but keep the job in the Runs hub.
  function detachFromActiveRun() {
    activeJobGenRef.current++
    activeJobIdRef.current = null
    activeTrackIdRef.current = null
    humanReviewResolveRef.current?.("rejected")
    chatbotResolveRef.current?.(
      buildChatbotResult("", [], "exit"),
    )
    clearRunUiState()
  }

  function resetRunState() {
    activeJobGenRef.current++
    activeJobIdRef.current = null
    activeTrackIdRef.current = null
    clearRunUiState()
    setRunNotes("")
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
    prevConfigKeyRef.current = configResetKey
    if (phase === RunPhase.Running) {
      detachFromActiveRun()
      return
    }
    resetRunState()
  }, [configResetKey, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    if (isPreviewOnly()) return
    if (!allInputsReady || inputsInvalid) return
    const jobGen = ++activeJobGenRef.current
    const orderedIds = flattenInputDocIds(inputModules, inputDocs)
    const byModule = inputDocsByModuleFromAssignment(inputModules, inputDocs)
    const [primary, ...rest] = orderedIds
    invariant(primary, "start() called without primary input doc despite allInputsReady")
    if (phase === RunPhase.Done) {
      setRunNotes("")
      runNotesRef.current = ""
    }
    const signal = cancellable.begin()
    const trackId = runJobs.registerJob({
      source: RunJobSource.Inference,
      label: "Pipeline run",
      projectId,
      cancel: () => cancellable.stop(),
    })
    activeTrackIdRef.current = trackId
    setPhase(RunPhase.Running)
    setError(null)
    setRun(null)
    setStepStates(new Map())
    setDebugLogs([])
    setCodeExecByModule(new Map())
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
      setActiveJobId(jobId)
      runJobs.bindJobId(trackId, jobId)
      cancellable.trackJobId(jobId)
      refreshBilling().catch(console.error)
      const { run: finished, deduped } = await awaitRun(jobId, {
        signal,
        onStep: (steps) => {
          if (jobGen !== activeJobGenRef.current || activeJobIdRef.current !== jobId) return
          const merged = mergeStepStates(stepStatesRef.current, steps)
          stepStatesRef.current = merged
          runJobs.updateJobProgress(trackId, {
            stepStates: merged,
            progressPct: progressPctFromStepStates(modules, merged),
            activeStepLabel: activeStepLabelFromStepStates(modules, merged),
          })
          if (mountedRef.current) setStepStates(merged)
        },
        onLogs: (logs) => {
          if (jobGen !== activeJobGenRef.current || activeJobIdRef.current !== jobId) return
          if (!mountedRef.current) return
          setDebugLogs(logs)
        },
        onCodeExec: (state) => {
          if (jobGen !== activeJobGenRef.current || activeJobIdRef.current !== jobId) return
          if (!mountedRef.current) return
          flushSync(() => {
            setCodeExecByModule((prev) => new Map(prev).set(state.moduleId, state))
          })
        },
        onHumanReview: (spec) => {
          if (jobGen !== activeJobGenRef.current) {
            return Promise.resolve("rejected" as const)
          }
          if (!mountedRef.current) return Promise.resolve("rejected" as const)
          setPendingHumanReview(spec)
          return new Promise<"approved" | "rejected">((resolve) => {
            humanReviewResolveRef.current = resolve
          })
        },
        onChatbot: (spec) => {
          if (jobGen !== activeJobGenRef.current || !mountedRef.current) {
            return Promise.resolve(buildChatbotResult("", [], "exit"))
          }
          setPendingChatbot(spec)
          return new Promise<ChatbotResultValue>((resolve) => {
            chatbotResolveRef.current = resolve
          })
        },
        projectLlmProviders,
      })
      const notes = runNotesRef.current.trim() || undefined
      const withNotes = notes ? { ...finished, notes } : finished
      savedNotesRef.current = notes
      runJobs.completeJob(trackId, { runId: finished.id })
      activeTrackIdRef.current = null
      if (!runsRef.current.some((r) => r.id === finished.id)) {
        addRun(withNotes)
      }
      if (notes) updateRunNotes(finished.id, notes).catch(console.error)
      if (jobGen !== activeJobGenRef.current || !mountedRef.current) return
      setRun(withNotes)
      setDeduped(!!deduped)
      setPhase(RunPhase.Done)
    } catch (e) {
      if (isRunAbortedError(e)) {
        if (activeTrackIdRef.current) runJobs.stopJob(activeTrackIdRef.current)
        activeTrackIdRef.current = null
        if (jobGen !== activeJobGenRef.current || !mountedRef.current) return
        setPhase(RunPhase.Idle)
        return
      }
      if (activeTrackIdRef.current) runJobs.failJob(activeTrackIdRef.current, (e as Error).message)
      activeTrackIdRef.current = null
      if (jobGen !== activeJobGenRef.current || !mountedRef.current) return
      if (isRunBillingError(e)) refreshBilling({ force: true }).catch(console.error)
      if (e instanceof RunStartError && e.status === 404) onProjectNotFound?.(projectId)
      setError((e as Error).message)
      setPhase(RunPhase.Idle)
    } finally {
      cancellable.clear()
    }
  }

  function stop() {
    cancellable.stop()
    if (activeTrackIdRef.current) runJobs.stopJob(activeTrackIdRef.current)
    activeTrackIdRef.current = null
    activeJobGenRef.current++
    activeJobIdRef.current = null
    setPhase(RunPhase.Idle)
    setPendingHumanReview(null)
    humanReviewResolveRef.current = null
    setPendingChatbot(null)
    chatbotResolveRef.current = null
  }

  function resolveHumanReview(decision: "approved" | "rejected") {
    humanReviewResolveRef.current?.(decision)
    humanReviewResolveRef.current = null
    setPendingHumanReview(null)
  }

  function resolveChatbot(result: ChatbotResultValue) {
    chatbotResolveRef.current?.(result)
    chatbotResolveRef.current = null
    setPendingChatbot(null)
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
  } = useRunProgressUi({ modules, phase, stepStates, run, pendingHumanReview, pendingChatbot })

  const activeModuleId = useMemo(() => {
    for (const m of modules) {
      if (stepStates.get(m.id)?.status === "running") return m.id
    }
    return undefined
  }, [stepStates, modules])
  const moduleIds = useMemo(() => modules.map((m) => m.id), [modules])
  const logsByModule = useMemo(() => {
    if (phase === RunPhase.Done && run) {
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
    codeExecByModule,
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
    pendingChatbot,
    activeJobId,
    deduped,
    resolveHumanReview,
    resolveChatbot,
    start,
    stop,
    reset,
    resetRunState,
  }
}
