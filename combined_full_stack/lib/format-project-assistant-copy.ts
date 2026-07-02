import type { AssistantChatMessage } from "@/components/assistant-chat"
import type { AssistantDebugEntry, AssistantStreamingDraft } from "@/lib/assistant-chat-types"
import type { ProjectProposal } from "@/lib/project-assistant-types"

type ProjectAssistantCopyHumanTurn = {
  human: string
}

type ProjectAssistantCopyAgentPayload = {
  message: string
  proposal?: ProjectProposal
  status?: string
  validationErrors?: string | null
  retryCount?: number
  invalidCount?: number
  debugTrace?: AssistantDebugEntry[]
  streaming?: boolean
}

type ProjectAssistantCopyAgentTurn = {
  agent: ProjectAssistantCopyAgentPayload
}

export type ProjectAssistantCopyTurn =
  | ProjectAssistantCopyHumanTurn
  | ProjectAssistantCopyAgentTurn

function agentTurnFromMessage(
  msg: AssistantChatMessage<ProjectProposal>,
): ProjectAssistantCopyAgentTurn {
  const payload: ProjectAssistantCopyAgentPayload = { message: msg.content }
  if (msg.proposal) payload.proposal = msg.proposal
  if (msg.status) payload.status = msg.status
  if (msg.validationErrors) payload.validationErrors = msg.validationErrors
  if (msg.retryCount != null) payload.retryCount = msg.retryCount
  if (msg.invalidCount != null) payload.invalidCount = msg.invalidCount
  if (msg.debugTrace && msg.debugTrace.length > 0) payload.debugTrace = msg.debugTrace
  return { agent: payload }
}

function agentTurnFromStreamingDraft(
  draft: AssistantStreamingDraft,
): ProjectAssistantCopyAgentTurn | null {
  const debugTrace = [...draft.debugTrace]
  const hasThinkingEntry = debugTrace.some((e) => e.kind === "thinking")
  if (draft.liveThinking && !hasThinkingEntry) {
    debugTrace.push({ kind: "thinking", text: draft.liveThinking })
  }

  if (!draft.content && debugTrace.length === 0) return null

  const payload: ProjectAssistantCopyAgentPayload = {
    message: draft.content,
    streaming: true,
  }
  if (debugTrace.length > 0) payload.debugTrace = debugTrace
  return { agent: payload }
}

export function formatProjectAssistantConversation(
  messages: AssistantChatMessage<ProjectProposal>[],
  streamingDraft?: AssistantStreamingDraft | null,
): string {
  const conversation: ProjectAssistantCopyTurn[] = []

  for (const msg of messages) {
    if (msg.role === "user") {
      conversation.push({ human: msg.content })
      continue
    }
    conversation.push(agentTurnFromMessage(msg))
  }

  if (streamingDraft) {
    const draftTurn = agentTurnFromStreamingDraft(streamingDraft)
    if (draftTurn) conversation.push(draftTurn)
  }

  return JSON.stringify({ conversation }, null, 2)
}
