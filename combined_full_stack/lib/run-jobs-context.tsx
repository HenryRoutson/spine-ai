"use client"

// AI : global pipeline run registry — survives tab unmount so jobs keep updating and can be stopped from the header.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { uid } from "@/lib/id"
import type { ChatbotResultValue } from "@/lib/chatbot-step"
import type { ClientStepSpec } from "@/lib/run-types"
import type { RunJobId } from "@/lib/types"
import {
  type RegisterRunJobOpts,
  type RunJobProgressPatch,
  type TrackedRunJob,
  RunJobSource,
  TrackedRunJobStatus,
} from "@/lib/run-jobs-types"

type RunJobsContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  closeHub: () => void
  jobs: TrackedRunJob[]
  runningCount: number
  selectedJobId: string | null
  openJobDetail: (trackId: string) => void
  closeJobDetail: () => void
  registerJob: (opts: RegisterRunJobOpts) => string
  bindJobId: (trackId: string, jobId: RunJobId) => void
  updateJobProgress: (trackId: string, patch: RunJobProgressPatch) => void
  completeJob: (trackId: string, patch?: { runId?: string }) => void
  failJob: (trackId: string, errorMessage: string) => void
  stopJob: (trackId: string) => void
  removeJob: (trackId: string) => void
  runningInferenceForProject: (projectId: string) => TrackedRunJob | null
  runningTestsForProject: (projectId: string) => TrackedRunJob[]
  awaitHumanReview: (trackId: string, spec: ClientStepSpec) => Promise<"approved" | "rejected">
  resolveHumanReview: (trackId: string, decision: "approved" | "rejected") => void
  awaitChatbot: (trackId: string, spec: ClientStepSpec) => Promise<ChatbotResultValue>
  resolveChatbot: (trackId: string, result: ChatbotResultValue) => void
}

const RunJobsContext = createContext<RunJobsContextValue | null>(null)

const DONE_RETAIN_MS = 12_000

function patchJob(jobs: TrackedRunJob[], trackId: string, patch: Partial<TrackedRunJob>): TrackedRunJob[] {
  return jobs.map((j) => (j.id === trackId ? { ...j, ...patch } : j))
}

export function RunJobsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [jobs, setJobs] = useState<TrackedRunJob[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const selectedJobIdRef = useRef<string | null>(null)
  selectedJobIdRef.current = selectedJobId
  const cancelByTrackId = useRef(new Map<string, () => void>())
  const retainTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const humanReviewByTrackId = useRef(new Map<string, (decision: "approved" | "rejected") => void>())
  const chatbotByTrackId = useRef(new Map<string, (result: ChatbotResultValue) => void>())

  const clearPauseResolvers = useCallback((trackId: string) => {
    humanReviewByTrackId.current.delete(trackId)
    chatbotByTrackId.current.delete(trackId)
  }, [])

  const closeHub = useCallback(() => {
    setOpen(false)
    setSelectedJobId(null)
  }, [])

  const toggle = useCallback(() => {
    setOpen((v) => {
      if (v) setSelectedJobId(null)
      return !v
    })
  }, [])

  const openJobDetail = useCallback((trackId: string) => {
    setSelectedJobId(trackId)
    setOpen(true)
  }, [])

  const closeJobDetail = useCallback(() => setSelectedJobId(null), [])

  const clearRetainTimer = useCallback((trackId: string) => {
    const t = retainTimers.current.get(trackId)
    if (t) {
      clearTimeout(t)
      retainTimers.current.delete(trackId)
    }
  }, [])

  const scheduleRemove = useCallback(
    (trackId: string) => {
      clearRetainTimer(trackId)
      retainTimers.current.set(
        trackId,
        setTimeout(() => {
          retainTimers.current.delete(trackId)
          // AI : keep a finished job mounted while its fullscreen trace is open.
          if (selectedJobIdRef.current === trackId) {
            scheduleRemove(trackId)
            return
          }
          cancelByTrackId.current.delete(trackId)
          clearPauseResolvers(trackId)
          setJobs((prev) => prev.filter((j) => j.id !== trackId))
        }, DONE_RETAIN_MS),
      )
    },
    [clearPauseResolvers, clearRetainTimer],
  )

  const registerJob = useCallback((opts: RegisterRunJobOpts): string => {
    const trackId = uid("track_")
    cancelByTrackId.current.set(trackId, opts.cancel)
    const selectedId = selectedJobIdRef.current
    setJobs((prev) => [
      {
        id: trackId,
        jobId: null,
        source: opts.source,
        label: opts.label,
        projectId: opts.projectId,
        status: TrackedRunJobStatus.Running,
        stepStates: new Map(),
        progressPct: 0,
        activeStepLabel: null,
        startedAt: Date.now(),
        testDocName: opts.testDocName,
        modules: opts.modules ?? [],
        inputDocs: opts.inputDocs ?? {},
        debugLogs: [],
        codeExecByModule: new Map(),
      },
      ...prev.filter((j) => j.status === TrackedRunJobStatus.Running || j.id === selectedId),
    ])
    setOpen(true)
    return trackId
  }, [])

  const bindJobId = useCallback((trackId: string, jobId: RunJobId) => {
    setJobs((prev) => patchJob(prev, trackId, { jobId }))
  }, [])

  const updateJobProgress = useCallback((trackId: string, patch: RunJobProgressPatch) => {
    setJobs((prev) => {
      const cur = prev.find((j) => j.id === trackId)
      if (!cur || cur.status !== TrackedRunJobStatus.Running) return prev
      return patchJob(prev, trackId, {
        stepStates: patch.stepStates ?? cur.stepStates,
        progressPct: patch.progressPct ?? cur.progressPct,
        activeStepLabel: patch.activeStepLabel !== undefined ? patch.activeStepLabel : cur.activeStepLabel,
        debugLogs: patch.debugLogs ?? cur.debugLogs,
        codeExecByModule: patch.codeExecByModule ?? cur.codeExecByModule,
        pendingHumanReview:
          patch.pendingHumanReview !== undefined ? patch.pendingHumanReview : cur.pendingHumanReview,
        pendingChatbot: patch.pendingChatbot !== undefined ? patch.pendingChatbot : cur.pendingChatbot,
      })
    })
  }, [])

  const finishJob = useCallback(
    (trackId: string, status: TrackedRunJobStatus, patch: Partial<TrackedRunJob> = {}) => {
      clearRetainTimer(trackId)
      cancelByTrackId.current.delete(trackId)
      clearPauseResolvers(trackId)
      setJobs((prev) => {
        const cur = prev.find((j) => j.id === trackId)
        if (!cur || cur.status !== TrackedRunJobStatus.Running) return prev
        return patchJob(prev, trackId, {
          status,
          finishedAt: Date.now(),
          pendingHumanReview: null,
          pendingChatbot: null,
          ...patch,
        })
      })
      scheduleRemove(trackId)
    },
    [clearPauseResolvers, clearRetainTimer, scheduleRemove],
  )

  const completeJob = useCallback(
    (trackId: string, patch?: { runId?: string }) => {
      finishJob(trackId, TrackedRunJobStatus.Done, { progressPct: 100, activeStepLabel: null, runId: patch?.runId })
    },
    [finishJob],
  )

  const failJob = useCallback(
    (trackId: string, errorMessage: string) => {
      finishJob(trackId, TrackedRunJobStatus.Error, { errorMessage, activeStepLabel: null })
    },
    [finishJob],
  )

  const stopJob = useCallback(
    (trackId: string) => {
      cancelByTrackId.current.get(trackId)?.()
      finishJob(trackId, TrackedRunJobStatus.Stopped, { errorMessage: "Stopped", activeStepLabel: null })
    },
    [finishJob],
  )

  const removeJob = useCallback(
    (trackId: string) => {
      clearRetainTimer(trackId)
      cancelByTrackId.current.delete(trackId)
      clearPauseResolvers(trackId)
      setJobs((prev) => prev.filter((j) => j.id !== trackId))
      setSelectedJobId((id) => (id === trackId ? null : id))
    },
    [clearPauseResolvers, clearRetainTimer],
  )

  const awaitHumanReview = useCallback((trackId: string, spec: ClientStepSpec) => {
    setJobs((prev) => patchJob(prev, trackId, { pendingHumanReview: spec }))
    return new Promise<"approved" | "rejected">((resolve) => {
      humanReviewByTrackId.current.set(trackId, resolve)
    })
  }, [])

  const resolveHumanReview = useCallback((trackId: string, decision: "approved" | "rejected") => {
    humanReviewByTrackId.current.get(trackId)?.(decision)
    humanReviewByTrackId.current.delete(trackId)
    setJobs((prev) => patchJob(prev, trackId, { pendingHumanReview: null }))
  }, [])

  const awaitChatbot = useCallback((trackId: string, spec: ClientStepSpec) => {
    setJobs((prev) => patchJob(prev, trackId, { pendingChatbot: spec }))
    return new Promise<ChatbotResultValue>((resolve) => {
      chatbotByTrackId.current.set(trackId, resolve)
    })
  }, [])

  const resolveChatbot = useCallback((trackId: string, result: ChatbotResultValue) => {
    chatbotByTrackId.current.get(trackId)?.(result)
    chatbotByTrackId.current.delete(trackId)
    setJobs((prev) => patchJob(prev, trackId, { pendingChatbot: null }))
  }, [])

  const runningCount = useMemo(() => jobs.filter((j) => j.status === TrackedRunJobStatus.Running).length, [jobs])

  const runningInferenceForProject = useCallback(
    (projectId: string) =>
      jobs.find((j) => j.status === TrackedRunJobStatus.Running && j.source === RunJobSource.Inference && j.projectId === projectId) ?? null,
    [jobs],
  )

  const runningTestsForProject = useCallback(
    (projectId: string) =>
      jobs.filter((j) => j.status === TrackedRunJobStatus.Running && j.source === RunJobSource.Testing && j.projectId === projectId),
    [jobs],
  )

  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      closeHub,
      jobs,
      runningCount,
      selectedJobId,
      openJobDetail,
      closeJobDetail,
      registerJob,
      bindJobId,
      updateJobProgress,
      completeJob,
      failJob,
      stopJob,
      removeJob,
      runningInferenceForProject,
      runningTestsForProject,
      awaitHumanReview,
      resolveHumanReview,
      awaitChatbot,
      resolveChatbot,
    }),
    [
      open,
      toggle,
      closeHub,
      jobs,
      runningCount,
      selectedJobId,
      openJobDetail,
      closeJobDetail,
      registerJob,
      bindJobId,
      updateJobProgress,
      completeJob,
      failJob,
      stopJob,
      removeJob,
      runningInferenceForProject,
      runningTestsForProject,
      awaitHumanReview,
      resolveHumanReview,
      awaitChatbot,
      resolveChatbot,
    ],
  )

  return <RunJobsContext.Provider value={value}>{children}</RunJobsContext.Provider>
}

export function useRunJobs() {
  const ctx = useContext(RunJobsContext)
  if (!ctx) throw new Error("useRunJobs must be used within RunJobsProvider")
  return ctx
}

export function useOptionalRunJobs() {
  return useContext(RunJobsContext)
}
