// AI : client types for pipeline runs tracked globally across tab switches.
import type { CodeExecUiState } from "@/lib/code-exec-ui"
import type { InputDocsAssignment } from "@/lib/inference-input"
import type { StepUiState } from "@/lib/run-engine"
import type { ClientStepSpec, JobLogEntry } from "@/lib/run-types"
import type { ModuleId, PipelineModule, ProjectId, RunJobId } from "@/lib/types"

export enum RunJobSource {
  Inference = "inference",
  Testing = "testing",
}

export enum TrackedRunJobStatus {
  Running = "running",
  Done = "done",
  Error = "error",
  Stopped = "stopped",
}

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
  modules: PipelineModule[]
  inputDocs: InputDocsAssignment
  debugLogs: JobLogEntry[]
  codeExecByModule: Map<ModuleId, CodeExecUiState>
  pendingHumanReview?: ClientStepSpec | null
  pendingChatbot?: ClientStepSpec | null
}

export type RegisterRunJobOpts = {
  source: RunJobSource
  label: string
  projectId: ProjectId
  testDocName?: string
  modules?: PipelineModule[]
  inputDocs?: InputDocsAssignment
  cancel: () => void
}

export type RunJobProgressPatch = {
  stepStates?: Map<ModuleId, StepUiState>
  progressPct?: number
  activeStepLabel?: string | null
  debugLogs?: JobLogEntry[]
  codeExecByModule?: Map<ModuleId, CodeExecUiState>
  pendingHumanReview?: ClientStepSpec | null
  pendingChatbot?: ClientStepSpec | null
}
