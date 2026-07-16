// AI : client types for concurrent run-error diagnosis agents.

import type { AssistantDebugEntry } from "@/lib/assistant-chat-types"
import type { PipelineRun } from "@/lib/types"

export type DiagnosisAgentStatus = "queued" | "running" | "done" | "error"

export type DiagnosisAgentSession = {
  id: string
  runId: PipelineRun["id"]
  runLabel: string
  projectId: string
  status: DiagnosisAgentStatus
  autoStarted: boolean
  startedAt: number
  finishedAt?: number
  costCents: number
  errorMessage?: string
  responseText: string
  debugTrace: AssistantDebugEntry[]
}

export type DiagnosisSpawnOptions = {
  run: PipelineRun
  projectId: string
  runLabel: string
  autoStarted?: boolean
  message?: string
}
