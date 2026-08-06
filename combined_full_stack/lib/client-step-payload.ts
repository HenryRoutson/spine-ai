import type { JobLogEntry } from "@/lib/run-types"
import type { StepCodeProfile } from "@/lib/code-exec-ui"

// AI : keep in sync with clientStepBodySchema in lib/server/api_schemas.ts
export const MAX_CLIENT_STEP_ERROR_CHARS = 4_000
export const MAX_CLIENT_LOG_LINE_CHARS = 8_000

export type ClientStepSubmitPayload = {
  output?: unknown
  error?: string
  clientLogs?: JobLogEntry[]
  codeProfile?: StepCodeProfile
}

export function truncateClientStepText(text: string, max: number): string {
  if (text.length <= max) return text
  const omitted = text.length - max + 48
  return `${text.slice(0, max - 48)}\n… [truncated ${omitted} chars]`
}

// AI : failure logs must not embed full list inputs — preview only, stays under log line cap.
export function previewCustomCodeInput(input: unknown, max = 2_400): string {
  if (input === undefined) return "(undefined)"
  let json: string
  try {
    json = JSON.stringify(input, null, 2)
  } catch {
    return truncateClientStepText(String(input), max)
  }
  if (json.length <= max) return json
  if (Array.isArray(input)) {
    return `Array(${input.length}) — preview truncated:\n${json.slice(0, max)}…`
  }
  if (input && typeof input === "object") {
    const keys = Object.keys(input as Record<string, unknown>)
    return `Object{${keys.join(", ")}} — preview truncated:\n${json.slice(0, max)}…`
  }
  return `${json.slice(0, max)}…`
}

export function sanitizeClientStepPayload(payload: ClientStepSubmitPayload): ClientStepSubmitPayload {
  const out: ClientStepSubmitPayload = { ...payload }
  if (typeof out.error === "string") {
    out.error = truncateClientStepText(out.error, MAX_CLIENT_STEP_ERROR_CHARS)
  }
  if (out.clientLogs?.length) {
    out.clientLogs = out.clientLogs.map((entry) => ({
      ...entry,
      line: truncateClientStepText(entry.line, MAX_CLIENT_LOG_LINE_CHARS),
    }))
  }
  return out
}
