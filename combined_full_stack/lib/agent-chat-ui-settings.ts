// AI : agent tab chrome — Current (NDJSON + ChatInput) vs assistant-ui Thread vs AI SDK useChat.
// AI : default stays Current so CLI/MCP/billing/proposal apply are unchanged until you opt in.

import { stringBrowserPref } from "@/lib/browser-storage-pref"
import { useBrowserPrefEvent } from "@/lib/use-browser-pref-event"

export const AGENT_CHAT_UI_KITS = ["current", "assistant-ui", "ai-sdk"] as const

export type AgentChatUiKit = (typeof AGENT_CHAT_UI_KITS)[number]

export const AGENT_CHAT_UI_KIT_META: Record<
  AgentChatUiKit,
  { label: string; shortLabel: string; description: string }
> = {
  current: {
    label: "Current",
    shortLabel: "Current",
    description: "Existing Spine chat: NDJSON stream, custom bubbles, paste chips, @ mentions.",
  },
  "assistant-ui": {
    label: "assistant-ui",
    shortLabel: "aui",
    description: "assistant-ui Thread + Composer on the Vercel AI SDK UIMessage stream.",
  },
  "ai-sdk": {
    label: "Vercel AI SDK",
    shortLabel: "SDK",
    description: "useChat + Conversation / PromptInput on the same UIMessage stream.",
  },
}

export const DEFAULT_AGENT_CHAT_UI_KIT: AgentChatUiKit = "current"

export const AGENT_CHAT_UI_SETTINGS_CHANGED_EVENT = "agent-chat-ui-settings-changed" as const

export function isAgentChatUiKit(v: string): v is AgentChatUiKit {
  return (AGENT_CHAT_UI_KITS as readonly string[]).includes(v)
}

const agentChatUiPref = stringBrowserPref<AgentChatUiKit>({
  keySuffix: "agent-chat-ui",
  defaultValue: DEFAULT_AGENT_CHAT_UI_KIT,
  changedEvent: AGENT_CHAT_UI_SETTINGS_CHANGED_EVENT,
  isValid: isAgentChatUiKit,
})

export const AGENT_CHAT_UI_KEY = agentChatUiPref.key
export const readAgentChatUiKit = agentChatUiPref.read
export const writeAgentChatUiKit = agentChatUiPref.write

export function useAgentChatUiKit(): AgentChatUiKit {
  return useBrowserPrefEvent(AGENT_CHAT_UI_SETTINGS_CHANGED_EVENT, readAgentChatUiKit)
}
