// AI : assistant chat input prefs — default text vs voice compose mode.

import { stringBrowserPref } from "@/lib/browser-storage-pref"
import { useBrowserPrefEvent } from "@/lib/use-browser-pref-event"
import type { FeedbackInputMode } from "@/lib/feedback-types"

export const CHAT_SETTINGS_CHANGED_EVENT = "chat-settings-changed" as const

export const DEFAULT_CHAT_INPUT_MODE: FeedbackInputMode = "text"

const CHAT_INPUT_MODES = ["text", "voice", "both"] as const satisfies readonly FeedbackInputMode[]

function isChatInputMode(v: string): v is FeedbackInputMode {
  return (CHAT_INPUT_MODES as readonly string[]).includes(v)
}

const chatInputModePref = stringBrowserPref({
  keySuffix: "chat-input-mode",
  defaultValue: DEFAULT_CHAT_INPUT_MODE,
  changedEvent: CHAT_SETTINGS_CHANGED_EVENT,
  isValid: isChatInputMode,
})

export const CHAT_INPUT_MODE_KEY = chatInputModePref.key

export const readChatInputMode = chatInputModePref.read
export const writeChatInputMode = chatInputModePref.write

export function useChatInputMode(): FeedbackInputMode {
  return useBrowserPrefEvent(CHAT_SETTINGS_CHANGED_EVENT, readChatInputMode)
}
