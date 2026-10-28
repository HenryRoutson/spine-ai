// AI : shared debug trace types (client + server).

export type AssistantLoadingPhase = "thinking" | "observing" | "coding" | "structuring" | "retrying"

// AI : debug-trace discriminant — keep wire strings stable for streamed events + UI.
export const AssistantDebugKind = {
  Phase: "phase",
  Thinking: "thinking",
  LlmResponse: "llm_response",
  StructuredFailure: "structured_failure",
  ValidationFailed: "validation_failed",
  Done: "done",
  Error: "error",
} as const

export type AssistantDebugKind = (typeof AssistantDebugKind)[keyof typeof AssistantDebugKind]

export type AssistantDebugEntry =
  | { kind: typeof AssistantDebugKind.Phase; phase: AssistantLoadingPhase }
  | { kind: typeof AssistantDebugKind.Thinking; text: string }
  | { kind: typeof AssistantDebugKind.LlmResponse; label: string; response: unknown }
  | {
      kind: typeof AssistantDebugKind.StructuredFailure
      attempt: number
      failureKind: string
      error: string
    }
  | { kind: typeof AssistantDebugKind.ValidationFailed; attempt: number; errors: string }
  | {
      kind: typeof AssistantDebugKind.Done
      message: string
      retryCount: number
      invalidCount: number
      validationErrors: string | null
      proposal: unknown | null
    }
  | { kind: typeof AssistantDebugKind.Error; error: string }

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
