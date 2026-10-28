// AI : pipeline assistant debug trace — streamed to client for live + copy-all debugging.

import {
  ASSISTANT_STREAM_EVENT,
  AssistantDebugKind,
  type AssistantDebugEntry,
  type AssistantLoadingPhase,
} from "@/lib/assistant-debug-types"

export type {
  AssistantDebugEntry,
  AssistantLoadingPhase,
} from "@/lib/assistant-debug-types"

export { ASSISTANT_STREAM_EVENT } from "@/lib/assistant-debug-types"

export function appendAssistantDebugEntry(
  entries: AssistantDebugEntry[],
  entry: AssistantDebugEntry,
): AssistantDebugEntry[] {
  return [...entries, entry]
}

export function streamEventToDebugEntry(
  evt: Record<string, unknown> & { type: string },
): AssistantDebugEntry | null {
  switch (evt.type) {
    case ASSISTANT_STREAM_EVENT.PHASE:
      return typeof evt.phase === "string"
        ? { kind: AssistantDebugKind.Phase, phase: evt.phase as AssistantLoadingPhase }
        : null
    case ASSISTANT_STREAM_EVENT.THINKING_DONE:
      return typeof evt.text === "string" ? { kind: AssistantDebugKind.Thinking, text: evt.text } : null
    case ASSISTANT_STREAM_EVENT.LLM_RESPONSE:
      return typeof evt.label === "string"
        ? { kind: AssistantDebugKind.LlmResponse, label: evt.label, response: evt.response }
        : null
    case ASSISTANT_STREAM_EVENT.STRUCTURED_FAILURE:
      return typeof evt.attempt === "number" &&
        typeof evt.failureKind === "string" &&
        typeof evt.error === "string"
        ? {
            kind: AssistantDebugKind.StructuredFailure,
            attempt: evt.attempt,
            failureKind: evt.failureKind,
            error: evt.error,
          }
        : null
    case ASSISTANT_STREAM_EVENT.VALIDATION_FAILED:
      return typeof evt.attempt === "number" && typeof evt.errors === "string"
        ? { kind: AssistantDebugKind.ValidationFailed, attempt: evt.attempt, errors: evt.errors }
        : null
    case ASSISTANT_STREAM_EVENT.DONE:
      return {
        kind: AssistantDebugKind.Done,
        message: typeof evt.message === "string" ? evt.message : "",
        retryCount: typeof evt.retryCount === "number" ? evt.retryCount : 0,
        invalidCount: typeof evt.invalidCount === "number" ? evt.invalidCount : 0,
        validationErrors:
          typeof evt.validationErrors === "string" ? evt.validationErrors : null,
        proposal: evt.proposal ?? null,
      }
    case ASSISTANT_STREAM_EVENT.ERROR:
      return typeof evt.error === "string" ? { kind: AssistantDebugKind.Error, error: evt.error } : null
    default:
      return null
  }
}

// AI : UI-aligned debug text for conversation copy (matches AssistantDebugPanel display).
export function formatAssistantDebugTraceDisplay(entries: AssistantDebugEntry[]): string {
  const lines: string[] = ["Debug trace", ""]
  for (const entry of entries) {
    switch (entry.kind) {
      case AssistantDebugKind.Phase:
        lines.push(entry.phase, "")
        break
      case AssistantDebugKind.Thinking:
        lines.push("Thinking", "", entry.text, "")
        break
      case AssistantDebugKind.LlmResponse:
        lines.push(
          `LLM response · ${entry.label}`,
          "",
          JSON.stringify(entry.response, null, 2),
          "",
        )
        break
      case AssistantDebugKind.StructuredFailure:
        lines.push(
          `Structured failure · attempt ${entry.attempt} · ${entry.failureKind}`,
          "",
          entry.error,
          "",
        )
        break
      case AssistantDebugKind.ValidationFailed:
        lines.push(`Validation failed · retry ${entry.attempt}`, "", entry.errors, "")
        break
      case AssistantDebugKind.Done:
        lines.push(
          `Done · ${entry.retryCount} retries · ${entry.invalidCount} invalid`,
          "",
        )
        if (entry.validationErrors) lines.push(entry.validationErrors, "")
        break
      case AssistantDebugKind.Error:
        lines.push("Error", "", entry.error, "")
        break
    }
  }
  return lines.join("\n").trimEnd()
}

export function formatAssistantDebugTrace(entries: AssistantDebugEntry[]): string {
  const lines: string[] = ["=== Pipeline assistant debug trace ===", ""]
  for (const e of entries) {
    switch (e.kind) {
      case AssistantDebugKind.Phase:
        lines.push(`--- ${e.phase} ---`, "")
        break
      case AssistantDebugKind.Thinking:
        lines.push("--- thinking ---", e.text, "")
        break
      case AssistantDebugKind.LlmResponse:
        lines.push(`--- llm response (${e.label}) ---`, JSON.stringify(e.response, null, 2), "")
        break
      case AssistantDebugKind.StructuredFailure:
        lines.push(
          `--- structured failure (attempt ${e.attempt}, ${e.failureKind}) ---`,
          e.error,
          "",
        )
        break
      case AssistantDebugKind.ValidationFailed:
        lines.push(`--- validation failed (retry ${e.attempt}) ---`, e.errors, "")
        break
      case AssistantDebugKind.Done:
        lines.push(
          "--- done ---",
          `message: ${e.message}`,
          `retryCount: ${e.retryCount}`,
          `invalidCount: ${e.invalidCount}`,
        )
        if (e.validationErrors) lines.push(`validationErrors:\n${e.validationErrors}`)
        if (e.proposal) lines.push("proposal:", JSON.stringify(e.proposal, null, 2))
        lines.push("")
        break
      case AssistantDebugKind.Error:
        lines.push("--- error ---", e.error, "")
        break
    }
  }
  return lines.join("\n").trimEnd()
}
