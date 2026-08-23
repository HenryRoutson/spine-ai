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
import { flattenPipelineModules } from "@/lib/fork-pipeline"
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
import { uid } from "@/lib/id"
import { isRunAbortedError, useCancellableRunRegistry } from "@/lib/use-cancellable-run"
import type { JobLogEntry, ModuleId, PipelineModule, PipelineRun, ProjectId, RunJobId } from "@/lib/types"
import type { ClientStepSpec } from "@/lib/run-types"
import type { CodeExecUiState } from "@/lib/code-exec-ui"
import { type ChatbotResultValue } from "@/lib/chatbot-step"
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
  flushPendingSave?: () => Promise<boolean | void>
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
  const [attachedTrackId, setAttachedTrackId] = useState<string | null>(null)
  const [deduped, setDeduped] = useState(false)
  const runNotesRef = useRef("")
  const savedNotesRef = useRef<string | undefined>(undefined)
  const logEndRef = useRef<HTMLDivElement>(null)
  const activeJobIdRef = useRef<RunJobId | null>(null)
  const activeTrackIdRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const stepStatesRef = useRef<Map<ModuleId, StepUiState>>(new Map())
  const runsRef = useRef(runs)
  runsRef.current = runs
  const runJobs = useRunJobs()
  const cancellable = useCancellableRunRegistry<string>()

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
    setAttachedTrackId(null)
    setDeduped(false)
  }

  // AI : drop local step-trace UI but keep hub progress updating for the orphaned job.
  function detachFromActiveRun() {
    activeJobIdRef.current = null
    activeTrackIdRef.current = null
    clearRunUiState()
  }

  function resetRunState() {
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

  function isAttached(trackId: string): boolean {
    return activeTrackIdRef.current === trackId && mountedRef.current
  }

  async function start() {
    if (isPreviewOnly()) return
    if (!allInputsReady || inputsInvalid) return
    const orderedIds = flattenInputDocIds(inputModules, inputDocs)
    const byModule = inputDocsByModuleFromAssignment(inputModules, inputDocs)
    const [primary, ...rest] = orderedIds
    invariant(primary, "start() called without primary input doc despite allInputsReady")
    if (phase === RunPhase.Done) {
      setRunNotes("")
      runNotesRef.current = ""
    }
    const runKey = uid("inf_")
    const signal = cancellable.begin(runKey)
    const trackId = runJobs.registerJob({
      source: RunJobSource.Inference,
      label: "Pipeline run",
      projectId,
      modules,
      inputDocs,
      cancel: () => cancellable.stop(runKey),
    })
    let localSteps = new Map<ModuleId, StepUiState>()
    let localCodeExec = new Map<ModuleId, CodeExecUiState>()
    activeTrackIdRef.current = trackId
    activeJobIdRef.current = null
    setAttachedTrackId(trackId)
    setPhase(RunPhase.Running)
    setError(null)
    setRun(null)
    setStepStates(new Map())
    stepStatesRef.current = new Map()
    setDebugLogs([])
    setCodeExecByModule(new Map())
    setPendingHumanReview(null)
    setPendingChatbot(null)
    setActiveJobId(null)
    try {
      // AI : flush any debounced project save before starting — prevents stale server state causing 400.
      await flushPendingSave?.()
      const started = await startRun(
        projectId,
        primary,
        model,
        rest,
        byModule,
        readAllowDuplicateRuns(),
      )
      if (signal.aborted) return
      if (started.run) {
        const finished = started.run
        const fromRun = new Map<ModuleId, StepUiState>()
        for (const step of finished.steps) {
          fromRun.set(step.moduleId, {
            status: step.status,
            outputPreview: step.outputPreview,
            inputDescriptionCheck: step.inputDescriptionCheck,
            descriptionCheckLlmCalls: step.descriptionCheckLlmCalls,
            descriptionCheckCostCents: step.descriptionCheckCostCents,
          })
        }
        localSteps = fromRun
        runJobs.completeJob(trackId, { runId: finished.id })
        const notes = runNotesRef.current.trim() || undefined
        const withNotes = notes ? { ...finished, notes } : finished
        savedNotesRef.current = notes
        if (!runsRef.current.some((r) => r.id === finished.id)) addRun(withNotes)
        if (!isAttached(trackId)) return
        stepStatesRef.current = localSteps
        setStepStates(localSteps)
        setRun(withNotes)
        setDeduped(false)
        setPhase(RunPhase.Done)
        activeTrackIdRef.current = null
        setAttachedTrackId(null)
        return
      }
      const { jobId } = started
      if (signal.aborted) return
      runJobs.bindJobId(trackId, jobId)
      cancellable.trackJobId(runKey, jobId)
      if (isAttached(trackId)) {
        activeJobIdRef.current = jobId
        setActiveJobId(jobId)
      }
      refreshBilling().catch(console.error)
      const { run: finished, deduped } = await awaitRun(jobId, {
        signal,
        onStep: (steps) => {
          localSteps = mergeStepStates(localSteps, steps)
          runJobs.updateJobProgress(trackId, {
            stepStates: localSteps,
            progressPct: progressPctFromStepStates(modules, localSteps),
            activeStepLabel: activeStepLabelFromStepStates(modules, localSteps),
          })
          if (!isAttached(trackId)) return
          stepStatesRef.current = localSteps
          setStepStates(localSteps)
        },
        onLogs: (logs) => {
          runJobs.updateJobProgress(trackId, { debugLogs: logs })
          if (isAttached(trackId)) setDebugLogs(logs)
        },
        onCodeExec: (state) => {
          localCodeExec = new Map(localCodeExec).set(state.moduleId, state)
          runJobs.updateJobProgress(trackId, { codeExecByModule: localCodeExec })
          if (!isAttached(trackId)) return
          flushSync(() => {
            setCodeExecByModule(new Map(localCodeExec))
          })
        },
        onHumanReview: (spec) => {
          if (isAttached(trackId)) setPendingHumanReview(spec)
          return runJobs.awaitHumanReview(trackId, spec)
        },
        onChatbot: (spec) => {
          if (isAttached(trackId)) setPendingChatbot(spec)
          return runJobs.awaitChatbot(trackId, spec)
        },
        projectLlmProviders,
      })
      const notes = runNotesRef.current.trim() || undefined
      const withNotes = notes ? { ...finished, notes } : finished
      savedNotesRef.current = notes
      runJobs.completeJob(trackId, { runId: finished.id })
      if (!runsRef.current.some((r) => r.id === finished.id)) {
        addRun(withNotes)
      }
      if (notes) updateRunNotes(finished.id, notes).catch(console.error)
      if (!isAttached(trackId)) return
      activeTrackIdRef.current = null
      setAttachedTrackId(null)
      setRun(withNotes)
      setDeduped(!!deduped)
      setPhase(RunPhase.Done)
    } catch (e) {
      if (isRunAbortedError(e)) {
        runJobs.stopJob(trackId)
        if (!isAttached(trackId)) return
        activeTrackIdRef.current = null
        activeJobIdRef.current = null
        setAttachedTrackId(null)
        setPhase(RunPhase.Idle)
        return
      }
      runJobs.failJob(trackId, (e as Error).message)
      if (!isAttached(trackId)) return
      activeTrackIdRef.current = null
      activeJobIdRef.current = null
      setAttachedTrackId(null)
      if (isRunBillingError(e)) refreshBilling({ force: true }).catch(console.error)
      if (e instanceof RunStartError && e.status === 404) onProjectNotFound?.(projectId)
      setError((e as Error).message)
      setPhase(RunPhase.Idle)
    } finally {
      cancellable.clear(runKey)
    }
  }

  function stop() {
    const trackId = activeTrackIdRef.current
    if (trackId) runJobs.stopJob(trackId)
    activeTrackIdRef.current = null
    activeJobIdRef.current = null
    setAttachedTrackId(null)
    setPhase(RunPhase.Idle)
    setPendingHumanReview(null)
    setPendingChatbot(null)
  }

  function resolveHumanReview(decision: "approved" | "rejected") {
    const trackId = activeTrackIdRef.current
    if (trackId) runJobs.resolveHumanReview(trackId, decision)
    setPendingHumanReview(null)
  }

  function resolveChatbot(result: ChatbotResultValue) {
    const trackId = activeTrackIdRef.current
    if (trackId) runJobs.resolveChatbot(trackId, result)
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
    for (const m of flattenPipelineModules(modules)) {
      if (stepStates.get(m.id)?.status === "running") return m.id
    }
    return undefined
  }, [stepStates, modules])
  const moduleIds = useMemo(() => flattenPipelineModules(modules).map((m) => m.id), [modules])
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
    attachedTrackId,
    deduped,
    resolveHumanReview,
    resolveChatbot,
    start,
    stop,
    reset,
    resetRunState,
  }
}
