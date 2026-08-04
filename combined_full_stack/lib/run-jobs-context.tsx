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
import type { StepUiState } from "@/lib/run-engine"
import type { ModuleId, RunJobId } from "@/lib/types"
import { type RegisterRunJobOpts, type TrackedRunJob, RunJobSource, TrackedRunJobStatus } from "@/lib/run-jobs-types"

type RunJobsContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  jobs: TrackedRunJob[]
  runningCount: number
  registerJob: (opts: RegisterRunJobOpts) => string
  bindJobId: (trackId: string, jobId: RunJobId) => void
  updateJobProgress: (
    trackId: string,
    patch: { stepStates?: Map<ModuleId, StepUiState>; progressPct?: number; activeStepLabel?: string | null },
  ) => void
  completeJob: (trackId: string, patch?: { runId?: string }) => void
  failJob: (trackId: string, errorMessage: string) => void
  stopJob: (trackId: string) => void
  removeJob: (trackId: string) => void
  runningInferenceForProject: (projectId: string) => TrackedRunJob | null
  runningTestsForProject: (projectId: string) => TrackedRunJob[]
}

const RunJobsContext = createContext<RunJobsContextValue | null>(null)

const DONE_RETAIN_MS = 12_000

function patchJob(jobs: TrackedRunJob[], trackId: string, patch: Partial<TrackedRunJob>): TrackedRunJob[] {
  return jobs.map((j) => (j.id === trackId ? { ...j, ...patch } : j))
}

export function RunJobsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [jobs, setJobs] = useState<TrackedRunJob[]>([])
  const cancelByTrackId = useRef(new Map<string, () => void>())
  const retainTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const toggle = useCallback(() => setOpen((v) => !v), [])

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
          cancelByTrackId.current.delete(trackId)
          setJobs((prev) => prev.filter((j) => j.id !== trackId))
        }, DONE_RETAIN_MS),
      )
    },
    [clearRetainTimer],
  )

  const registerJob = useCallback((opts: RegisterRunJobOpts): string => {
    const trackId = uid("track_")
    cancelByTrackId.current.set(trackId, opts.cancel)
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
      },
      ...prev.filter((j) => j.status === TrackedRunJobStatus.Running),
    ])
    setOpen(true)
    return trackId
  }, [])

  const bindJobId = useCallback((trackId: string, jobId: RunJobId) => {
    setJobs((prev) => patchJob(prev, trackId, { jobId }))
  }, [])

  const updateJobProgress = useCallback(
    (
      trackId: string,
      patch: { stepStates?: Map<ModuleId, StepUiState>; progressPct?: number; activeStepLabel?: string | null },
    ) => {
      setJobs((prev) => {
        const cur = prev.find((j) => j.id === trackId)
        if (!cur || cur.status !== TrackedRunJobStatus.Running) return prev
        return patchJob(prev, trackId, {
          stepStates: patch.stepStates ?? cur.stepStates,
          progressPct: patch.progressPct ?? cur.progressPct,
          activeStepLabel: patch.activeStepLabel !== undefined ? patch.activeStepLabel : cur.activeStepLabel,
        })
      })
    },
    [],
  )

  const finishJob = useCallback(
    (trackId: string, status: TrackedRunJobStatus, patch: Partial<TrackedRunJob> = {}) => {
      clearRetainTimer(trackId)
      cancelByTrackId.current.delete(trackId)
      setJobs((prev) => {
        const cur = prev.find((j) => j.id === trackId)
        if (!cur || cur.status !== TrackedRunJobStatus.Running) return prev
        return patchJob(prev, trackId, {
          status,
          finishedAt: Date.now(),
          ...patch,
        })
      })
      scheduleRemove(trackId)
    },
    [clearRetainTimer, scheduleRemove],
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
      setJobs((prev) => prev.filter((j) => j.id !== trackId))
    },
    [clearRetainTimer],
  )

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
      jobs,
      runningCount,
      registerJob,
      bindJobId,
      updateJobProgress,
      completeJob,
      failJob,
      stopJob,
      removeJob,
      runningInferenceForProject,
      runningTestsForProject,
    }),
    [
      open,
      toggle,
      jobs,
      runningCount,
      registerJob,
      bindJobId,
      updateJobProgress,
      completeJob,
      failJob,
      stopJob,
      removeJob,
      runningInferenceForProject,
      runningTestsForProject,
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
