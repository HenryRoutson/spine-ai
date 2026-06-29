// AI : shared debug trace types (client + server).

export type AssistantLoadingPhase = "thinking" | "structuring" | "retrying"

export type AssistantDebugEntry =
  | { kind: "phase"; phase: AssistantLoadingPhase }
  | { kind: "thinking"; text: string }
  | { kind: "llm_response"; label: string; response: unknown }
  | {
      kind: "structured_failure"
      attempt: number
      failureKind: string
      error: string
    }
  | { kind: "validation_failed"; attempt: number; errors: string }
  | {
      kind: "done"
      message: string
      retryCount: number
      invalidCount: number
      validationErrors: string | null
      proposal: unknown | null
    }
  | { kind: "error"; error: string }

export const ASSISTANT_STREAM_EVENT = {
  THINKING_DELTA: "thinking_delta",
  THINKING_DONE: "thinking_done",
  // AI : emitted as the assistant message text streams during the structuring phase.
  MESSAGE_DELTA: "message_delta",
  PHASE: "phase",
  LLM_RESPONSE: "llm_response",
  STRUCTURED_FAILURE: "structured_failure",
  VALIDATION_FAILED: "validation_failed",
  RETRYING: "retrying",
  DONE: "done",
  ERROR: "error",
} as const
