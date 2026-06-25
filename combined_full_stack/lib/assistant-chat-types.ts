// AI : shared assistant chat types and constants (client + server).

export type AssistantChatRole = "user" | "assistant"
export type ProposalStatus = "pending" | "approved" | "rejected"

export const ASSISTANT_HISTORY_LIMIT = 8
export const ASSISTANT_REQUEST_FAILED = "Assistant request failed" as const

export function assistantRequestFailed(status: number): string {
  return `request failed (${status})`
}

export const ASSISTANT_STREAM_EVENT = {
  RETRYING: "retrying",
  DONE: "done",
  ERROR: "error",
} as const
