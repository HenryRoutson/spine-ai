// AI : proposal turns carry validation context the server needs on follow-ups like "fix the issues".
// AI : Paste chips are folded into user content as <pasted>…</pasted> in AssistantChat.send before history.
// AI : @ / Select UI pins are summarized into history so follow-up turns still see what was pinned.

import type { AssistantChatRole } from "@/lib/assistant-chat-types"
import type { UiContextRef } from "@/lib/ui-context-types"

export type AssistantHistoryTurn = { role: AssistantChatRole; content: string }

type ProposalHistoryMsg = {
  role: AssistantChatRole
  content: string
  proposal?: unknown
  validationErrors?: string | null
  invalidCount?: number
  status?: string
  uiContext?: UiContextRef[]
}

function formatPinnedContextForHistory(pins: UiContextRef[]): string {
  if (pins.length === 0) return ""
  const lines = pins.map((p) => `- [${p.kind}] ${p.label}`)
  return `[Pinned context:\n${lines.join("\n")}]`
}

export function buildAssistantHistory(
  messages: ProposalHistoryMsg[],
  limit: number,
): AssistantHistoryTurn[] {
  return messages.slice(-limit).map((m) => {
    if (m.role === "user") {
      const pinBlock = formatPinnedContextForHistory(m.uiContext ?? [])
      const content = pinBlock ? `${m.content}\n\n${pinBlock}` : m.content
      return { role: "user", content }
    }
    if (!m.proposal) return { role: "assistant", content: m.content }

    const parts = [m.content]
    if (m.validationErrors?.trim()) {
      parts.push(
        `[That proposal had validation errors — user may ask you to fix these:\n${m.validationErrors.trim()}]`,
      )
    } else if (m.invalidCount && m.invalidCount > 0) {
      parts.push(`[That proposal had ${m.invalidCount} validation error(s).]`)
    }
    if (m.status === "approved") {
      parts.push("[User approved that proposal — it is now the live project state.]")
    }
    if (m.status === "rejected") {
      parts.push("[User rejected that proposal — live project unchanged unless noted above.]")
    }
    return { role: "assistant", content: parts.join("\n\n") }
  })
}
