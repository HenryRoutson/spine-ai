// AI : shared assistant chat types and constants (client + server).

import type { AssistantDebugEntry, AssistantLoadingPhase } from "@/lib/assistant-debug-types"

export type { AssistantDebugEntry, AssistantLoadingPhase } from "@/lib/assistant-debug-types"

export { ASSISTANT_STREAM_EVENT } from "@/lib/assistant-debug-types"

export type AssistantChatRole = "user" | "assistant"
export type ProposalStatus = "pending" | "approved" | "rejected"

// AI : in-flight assistant response — mirrored for copy while streaming (not persisted).
export type AssistantStreamingDraft = {
  content: string
  liveThinking: string
  debugTrace: AssistantDebugEntry[]
}

export const ASSISTANT_HISTORY_LIMIT = 8
export const ASSISTANT_REQUEST_FAILED = "Assistant request failed" as const

export function assistantRequestFailed(status: number): string {
  return `request failed (${status})`
}
