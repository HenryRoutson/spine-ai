// AI : step-trace server log visibility — stored in localStorage like json-viewer prefs.

import { appStorageKey } from "@/lib/storage-keys"

export const HIDE_SERVER_LOGS_KEY = appStorageKey("hide-server-logs")
export const HIDE_INPUT_DESCRIPTIONS_KEY = appStorageKey("hide-input-descriptions")
export const REQUIRE_INPUT_DESCRIPTIONS_KEY = appStorageKey("require-input-descriptions")
export const LOGGING_SETTINGS_CHANGED_EVENT = "logging-settings-changed" as const

export const DEFAULT_HIDE_SERVER_LOGS = true
export const DEFAULT_HIDE_INPUT_DESCRIPTIONS = true
export const DEFAULT_REQUIRE_INPUT_DESCRIPTIONS = false

export function readHideServerLogsDefault(): boolean {
  if (typeof window === "undefined") return DEFAULT_HIDE_SERVER_LOGS
  try {
    const v = localStorage.getItem(HIDE_SERVER_LOGS_KEY)
    if (v === "false") return false
    if (v === "true") return true
  } catch {
    /* ignore */
  }
  return DEFAULT_HIDE_SERVER_LOGS
}

export function writeHideServerLogsDefault(hide: boolean): void {
  localStorage.setItem(HIDE_SERVER_LOGS_KEY, hide ? "true" : "false")
  window.dispatchEvent(new Event(LOGGING_SETTINGS_CHANGED_EVENT))
}

export function readHideInputDescriptionsDefault(): boolean {
  if (typeof window === "undefined") return DEFAULT_HIDE_INPUT_DESCRIPTIONS
  try {
    const v = localStorage.getItem(HIDE_INPUT_DESCRIPTIONS_KEY)
    if (v === "false") return false
    if (v === "true") return true
  } catch {
    /* ignore */
  }
  return DEFAULT_HIDE_INPUT_DESCRIPTIONS
}

export function writeHideInputDescriptionsDefault(hide: boolean): void {
  localStorage.setItem(HIDE_INPUT_DESCRIPTIONS_KEY, hide ? "true" : "false")
  window.dispatchEvent(new Event(LOGGING_SETTINGS_CHANGED_EVENT))
}

export function readRequireInputDescriptions(): boolean {
  if (typeof window === "undefined") return DEFAULT_REQUIRE_INPUT_DESCRIPTIONS
  try {
    const v = localStorage.getItem(REQUIRE_INPUT_DESCRIPTIONS_KEY)
    if (v === "true") return true
    if (v === "false") return false
  } catch {
    /* ignore */
  }
  return DEFAULT_REQUIRE_INPUT_DESCRIPTIONS
}

export function writeRequireInputDescriptions(required: boolean): void {
  localStorage.setItem(REQUIRE_INPUT_DESCRIPTIONS_KEY, required ? "true" : "false")
  window.dispatchEvent(new Event(LOGGING_SETTINGS_CHANGED_EVENT))
}
