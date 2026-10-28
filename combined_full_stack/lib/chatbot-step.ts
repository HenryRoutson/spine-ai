// AI : client-safe chatbot step helpers — locked ChatbotPrompt in / ChatbotResult out.
import type { ModelId } from "@/lib/types"

export type ChatbotMode = "single" | "until-exit"

export type ChatbotTurnRole = "user" | "assistant" | "system"

export type ChatbotTurn = {
  role: ChatbotTurnRole
  content: string
}

export type ChatbotPromptValue = {
  prompt: string
}

export type ChatbotExitReason = "exit" | "single" | "max-turns"

export type ChatbotResultValue = {
  prompt: string
  transcript: ChatbotTurn[]
  exit_reason: ChatbotExitReason
}

export const DEFAULT_CHATBOT_MODE: ChatbotMode = "until-exit"
export const DEFAULT_CHATBOT_MAX_TURNS = 32

export function parseChatbotPrompt(input: unknown): ChatbotPromptValue {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Chatbot step expects ChatbotPrompt object with field `prompt`")
  }
  const prompt = (input as { prompt?: unknown }).prompt
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("ChatbotPrompt.prompt must be a non-empty string")
  }
  return { prompt: prompt.trim() }
}

export function buildChatbotResult(
  prompt: string,
  transcript: ChatbotTurn[],
  exit_reason: ChatbotExitReason,
): ChatbotResultValue {
  return {
    prompt,
    transcript: transcript.map((t) => ({
      role: t.role,
      content: typeof t.content === "string" ? t.content : String(t.content ?? ""),
    })),
    exit_reason,
  }
}

export function isChatbotMode(v: unknown): v is ChatbotMode {
  return v === "single" || v === "until-exit"
}

export function resolveChatbotMode(v: unknown): ChatbotMode {
  return isChatbotMode(v) ? v : DEFAULT_CHATBOT_MODE
}

export type ChatbotClientMeta = {
  chatbotMode: ChatbotMode
  model?: ModelId
  maxTurns?: number
}
