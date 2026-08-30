// AI : Spine AssistantChatMessage ↔ AI SDK UIMessage. Kits share this; the billed agent loop does not.

import type { UIMessage } from "ai"
import type { AssistantChatMessage } from "@/components/assistant-chat"
import {
  ASSISTANT_HISTORY_LIMIT,
  type AssistantLoadingPhase,
  type ProposalStatus,
} from "@/lib/assistant-chat-types"
import { buildAssistantHistory, type AssistantHistoryTurn } from "@/lib/assistant-history"
import { isCannedProjectAssistantWelcome, type ProjectProposal } from "@/lib/project-assistant-types"
import type { PastedAttachment } from "@/lib/pasted-attachment"
import type { UiContextRef } from "@/lib/ui-context-types"

export const AGENT_CONTEXT_ONLY_PLACEHOLDER = "(selected UI context)" as const

export type AgentProposalData = {
  proposal: ProjectProposal
  status: ProposalStatus
  invalidCount?: number
  retryCount?: number
  validationErrors?: string | null
}

export type AgentChatDataParts = {
  proposal: AgentProposalData
  phase: { phase: AssistantLoadingPhase }
}

export type AgentChatMetadata = {
  pastes?: PastedAttachment[]
  uiContext?: UiContextRef[]
  billedCents?: number
}

export type AgentUIMessage = UIMessage<AgentChatMetadata, AgentChatDataParts>

export type AgentSdkRequestExtras = {
  message?: string
  uiContext?: UiContextRef[]
  pendingProposal?: ProjectProposal | null
}

export function textFromUiParts(parts: AgentUIMessage["parts"] | undefined): string {
  if (!parts?.length) return ""
  return parts
    .filter((p): p is Extract<AgentUIMessage["parts"][number], { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("")
}

export function reasoningFromUiParts(parts: AgentUIMessage["parts"] | undefined): string {
  if (!parts?.length) return ""
  return parts
    .filter(
      (p): p is Extract<AgentUIMessage["parts"][number], { type: "reasoning" }> => p.type === "reasoning",
    )
    .map((p) => p.text)
    .join("")
}

export function proposalDataFromUiParts(
  parts: AgentUIMessage["parts"] | undefined,
): AgentProposalData | null {
  if (!parts?.length) return null
  for (const p of parts) {
    if (p.type === "data-proposal") return p.data
  }
  return null
}

export function toAgentUiMessages(
  messages: AssistantChatMessage<ProjectProposal>[],
): AgentUIMessage[] {
  const out: AgentUIMessage[] = []
  for (const m of messages) {
    if (m.role === "assistant" && isCannedProjectAssistantWelcome(m.content, m.id)) continue
    if (m.role === "user") {
      const parts: AgentUIMessage["parts"] = m.content
        ? [{ type: "text", text: m.content }]
        : []
      out.push({
        id: m.id,
        role: "user",
        parts,
        metadata: {
          ...(m.pastes?.length ? { pastes: m.pastes } : {}),
          ...(m.uiContext?.length ? { uiContext: m.uiContext } : {}),
        },
      })
      continue
    }
    const parts: AgentUIMessage["parts"] = []
    if (m.content) parts.push({ type: "text", text: m.content })
    if (m.proposal) {
      parts.push({
        type: "data-proposal",
        data: {
          proposal: m.proposal,
          status: m.status ?? "pending",
          invalidCount: m.invalidCount,
          retryCount: m.retryCount,
          validationErrors: m.validationErrors,
        },
      })
    }
    out.push({ id: m.id, role: "assistant", parts })
  }
  return out
}

export function fromAgentUiMessages(
  messages: AgentUIMessage[],
): AssistantChatMessage<ProjectProposal>[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const proposalData = m.role === "assistant" ? proposalDataFromUiParts(m.parts) : null
      return {
        id: m.id,
        role: m.role as "user" | "assistant",
        content: textFromUiParts(m.parts),
        pastes: m.metadata?.pastes,
        uiContext: m.metadata?.uiContext,
        proposal: proposalData?.proposal,
        status: proposalData?.status,
        invalidCount: proposalData?.invalidCount,
        retryCount: proposalData?.retryCount,
        validationErrors: proposalData?.validationErrors,
      }
    })
}

export function lastPendingProposalFromStored(
  messages: AssistantChatMessage<ProjectProposal>[],
): ProjectProposal | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.role === "assistant" && m.proposal && m.status === "pending") return m.proposal
  }
  return undefined
}

export function lastPendingProposalFromUi(messages: AgentUIMessage[]): ProjectProposal | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const data = proposalDataFromUiParts(messages[i]?.parts)
    if (data?.status === "pending") return data.proposal
  }
  return undefined
}

function lastUserIndex(messages: AgentUIMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return i
  }
  return -1
}

export function wireMessageFromUiText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed || trimmed === AGENT_CONTEXT_ONLY_PLACEHOLDER) return ""
  return trimmed
}

export function agentRequestFromUiMessages(
  messages: AgentUIMessage[],
  extras: AgentSdkRequestExtras = {},
): {
  message: string
  history: AssistantHistoryTurn[]
  uiContext?: UiContextRef[]
  pendingProposal?: ProjectProposal
} {
  const userIdx = lastUserIndex(messages)
  const lastUser = userIdx >= 0 ? messages[userIdx] : undefined
  const lastUserText = textFromUiParts(lastUser?.parts)
  // AI : empty extras.message is the assistant-ui Composer path — use the last user part.
  const extraWire = extras.message?.trim()
  const message = extraWire ? extras.message! : wireMessageFromUiText(lastUserText)
  const prior = userIdx >= 0 ? messages.slice(0, userIdx) : messages
  const history = buildAssistantHistory(fromAgentUiMessages(prior), ASSISTANT_HISTORY_LIMIT)
  const uiContext = extras.uiContext?.length
    ? extras.uiContext
    : lastUser?.metadata?.uiContext
  const pendingProposal = extras.pendingProposal ?? lastPendingProposalFromUi(messages)
  return {
    message,
    history,
    ...(uiContext?.length ? { uiContext } : {}),
    ...(pendingProposal ? { pendingProposal } : {}),
  }
}

export function assistantMessageFromProposal(
  messageId: string,
  data: AgentProposalData,
  text = "",
): AssistantChatMessage<ProjectProposal> {
  return {
    id: messageId,
    role: "assistant",
    content: text,
    proposal: data.proposal,
    status: data.status,
    invalidCount: data.invalidCount,
    retryCount: data.retryCount,
    validationErrors: data.validationErrors,
  }
}

export function withProposalStatus(
  messages: AgentUIMessage[],
  messageId: string,
  status: ProposalStatus,
): AgentUIMessage[] {
  return messages.map((m) => {
    if (m.id !== messageId) return m
    return {
      ...m,
      parts: m.parts.map((p) =>
        p.type === "data-proposal" ? { ...p, data: { ...p.data, status } } : p,
      ),
    }
  })
}
