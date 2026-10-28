// AI : server helper — one assistant turn while a chatbot client-step is paused.
import { llmString, type CallContext } from "@/lib/server/llm"
import type { ChatbotTurn } from "@/lib/chatbot-step"
import type { ModelId } from "@/lib/server/types"
import { UsageLedger } from "@/lib/server/usage"

export function formatChatbotTurnPrompt(sessionPrompt: string, transcript: ChatbotTurn[]): string {
  const lines = [
    "You are a pipeline chatbot. Follow the session prompt. Reply with one assistant message only — no JSON wrapper.",
    "",
    "## Session prompt",
    sessionPrompt,
    "",
    "## Transcript so far",
  ]
  if (transcript.length === 0) {
    lines.push("(empty — open the conversation)")
  } else {
    for (const t of transcript) {
      lines.push(`${t.role}: ${t.content}`)
    }
  }
  lines.push("", "Assistant:")
  return lines.join("\n")
}

export async function runChatbotAssistantTurn(opts: {
  sessionPrompt: string
  transcript: ChatbotTurn[]
  model: ModelId
}): Promise<{ reply: string; ledger: UsageLedger }> {
  const ledger = new UsageLedger()
  const ctx: CallContext = { model: opts.model, ledger }
  const ask = formatChatbotTurnPrompt(opts.sessionPrompt, opts.transcript)
  const reply = (await llmString(ask, ctx)).trim()
  if (!reply) throw new Error("chatbot model returned an empty reply")
  return { reply, ledger }
}
