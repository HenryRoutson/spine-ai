import {
  ASSISTANT_REQUEST_FAILED,
  ASSISTANT_STREAM_EVENT,
  type AssistantDebugEntry,
  type AssistantLoadingPhase,
} from "@/lib/assistant-chat-types"
import { appendAssistantDebugEntry, streamEventToDebugEntry } from "@/lib/assistant-debug"

type PipelineAssistantStreamHandlers = {
  onDebugEntry?: (entry: AssistantDebugEntry) => void
  onThinkingDelta?: (delta: string) => void
  // AI : fires as the assistant message text streams during the structuring phase.
  onMessageDelta?: (delta: string) => void
  onPhase?: (phase: AssistantLoadingPhase) => void
}

export async function readPipelineAssistantStream<TProposal>(
  res: Response,
  handlers: PipelineAssistantStreamHandlers = {},
): Promise<{
  message: string
  proposal?: TProposal
  invalidCount: number
  retryCount: number
  validationErrors: string | null
  billedCents: number
  usageCents: number
  debugTrace: AssistantDebugEntry[]
}> {
  const reader = res.body?.getReader()
  if (!reader) throw new Error("empty response body")

  const decoder = new TextDecoder()
  let buffer = ""
  let debugTrace: AssistantDebugEntry[] = []
  let result: {
    message: string
    proposal?: TProposal
    invalidCount: number
    retryCount: number
    validationErrors: string | null
    billedCents: number
    usageCents: number
  } | null = null

  const push = (entry: AssistantDebugEntry) => {
    debugTrace = appendAssistantDebugEntry(debugTrace, entry)
    handlers.onDebugEntry?.(entry)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.trim()) continue
      const evt = JSON.parse(line) as Record<string, unknown> & { type: string }
      const entry = streamEventToDebugEntry(evt)
      if (entry) push(entry)

      if (evt.type === ASSISTANT_STREAM_EVENT.THINKING_DELTA && typeof evt.text === "string") {
        handlers.onThinkingDelta?.(evt.text)
      }
      if (evt.type === ASSISTANT_STREAM_EVENT.MESSAGE_DELTA && typeof evt.text === "string") {
        handlers.onMessageDelta?.(evt.text)
      }
      if (evt.type === ASSISTANT_STREAM_EVENT.PHASE && typeof evt.phase === "string") {
        handlers.onPhase?.(evt.phase as AssistantLoadingPhase)
      }
      if (evt.type === ASSISTANT_STREAM_EVENT.VALIDATION_FAILED) {
        handlers.onPhase?.("retrying")
      }

      if (evt.type === ASSISTANT_STREAM_EVENT.ERROR) {
        throw new Error(
          typeof evt.error === "string" ? evt.error : ASSISTANT_REQUEST_FAILED,
        )
      }
      if (evt.type === ASSISTANT_STREAM_EVENT.DONE) {
        result = {
          message: typeof evt.message === "string" ? evt.message : "",
          proposal: (evt.proposal as TProposal | undefined) ?? undefined,
          invalidCount: typeof evt.invalidCount === "number" ? evt.invalidCount : 0,
          retryCount: typeof evt.retryCount === "number" ? evt.retryCount : 0,
          validationErrors:
            typeof evt.validationErrors === "string" ? evt.validationErrors : null,
          billedCents: typeof evt.billedCents === "number" ? evt.billedCents : 0,
          usageCents: typeof evt.usageCents === "number" ? evt.usageCents : 0,
        }
      }
    }
  }

  if (!result) throw new Error("Assistant stream ended without a result")
  return {
    ...result,
    billedCents: result.billedCents ?? 0,
    usageCents: result.usageCents ?? 0,
    debugTrace,
  }
}
