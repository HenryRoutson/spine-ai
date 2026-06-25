// AI : step-trace server log visibility — stored in localStorage like json-viewer prefs.

import { appStorageKey } from "@/lib/storage-keys"

export const HIDE_SERVER_LOGS_KEY = appStorageKey("hide-server-logs")
export const LOGGING_SETTINGS_CHANGED_EVENT = "logging-settings-changed" as const

export const DEFAULT_HIDE_SERVER_LOGS = true

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
