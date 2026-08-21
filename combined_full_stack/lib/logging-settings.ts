// AI : step-trace server log visibility — stored in localStorage like json-viewer prefs.

import { booleanBrowserPref } from "@/lib/browser-storage-pref"
import { appStorageKey } from "@/lib/storage-keys"

export const LOGGING_SETTINGS_CHANGED_EVENT = "logging-settings-changed" as const

export const DEFAULT_HIDE_SERVER_LOGS = true
export const DEFAULT_HIDE_INPUT_DESCRIPTIONS = true
export const DEFAULT_REQUIRE_INPUT_DESCRIPTIONS = false

const hideServerLogsPref = booleanBrowserPref({
  keySuffix: "hide-server-logs",
  defaultValue: DEFAULT_HIDE_SERVER_LOGS,
  changedEvent: LOGGING_SETTINGS_CHANGED_EVENT,
})

const hideInputDescriptionsPref = booleanBrowserPref({
  keySuffix: "hide-input-descriptions",
  defaultValue: DEFAULT_HIDE_INPUT_DESCRIPTIONS,
  changedEvent: LOGGING_SETTINGS_CHANGED_EVENT,
})

const requireInputDescriptionsPref = booleanBrowserPref({
  keySuffix: "require-input-descriptions",
  defaultValue: DEFAULT_REQUIRE_INPUT_DESCRIPTIONS,
  changedEvent: LOGGING_SETTINGS_CHANGED_EVENT,
})

export const SIMPLE_STEP_TRACE_KEY = appStorageKey("simple-step-trace")

export const HIDE_SERVER_LOGS_KEY = hideServerLogsPref.key
export const HIDE_INPUT_DESCRIPTIONS_KEY = hideInputDescriptionsPref.key
export const REQUIRE_INPUT_DESCRIPTIONS_KEY = requireInputDescriptionsPref.key

export const readHideServerLogsDefault = hideServerLogsPref.read
export const writeHideServerLogsDefault = hideServerLogsPref.write

export const readHideInputDescriptionsDefault = hideInputDescriptionsPref.read
export const writeHideInputDescriptionsDefault = hideInputDescriptionsPref.write

export const readRequireInputDescriptions = requireInputDescriptionsPref.read
export const writeRequireInputDescriptions = requireInputDescriptionsPref.write

export function readSimpleStepTrace(fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback
  try {
    const v = localStorage.getItem(SIMPLE_STEP_TRACE_KEY)
    if (v === "true") return true
    if (v === "false") return false
  } catch {
    /* ignore */
  }
  return fallback
}

export function writeSimpleStepTrace(value: boolean): void {
  localStorage.setItem(SIMPLE_STEP_TRACE_KEY, value ? "true" : "false")
  window.dispatchEvent(new Event(LOGGING_SETTINGS_CHANGED_EVENT))
}
