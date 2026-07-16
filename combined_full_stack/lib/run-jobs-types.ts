// AI : client types for pipeline runs tracked globally across tab switches.
import type { StepUiState } from "@/lib/run-engine"
import type { ModuleId, ProjectId, RunJobId } from "@/lib/types"

export type RunJobSource = "inference" | "testing"

export type TrackedRunJobStatus = "running" | "done" | "error" | "stopped"

export type TrackedRunJob = {
  id: string
  jobId: RunJobId | null
  source: RunJobSource
  label: string
  projectId: ProjectId
  status: TrackedRunJobStatus
  stepStates: Map<ModuleId, StepUiState>
  progressPct: number
  activeStepLabel: string | null
  startedAt: number
  finishedAt?: number
  errorMessage?: string
  testDocName?: string
  runId?: string
}

export type RegisterRunJobOpts = {
  source: RunJobSource
  label: string
  projectId: ProjectId
  testDocName?: string
  cancel: () => void
}
