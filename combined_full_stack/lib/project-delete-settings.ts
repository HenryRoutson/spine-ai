// AI : quick-delete from project lists — off by default; full flow lives in project settings.

import { booleanBrowserPref } from "@/lib/browser-storage-pref"

export const PROJECT_DELETE_SETTINGS_CHANGED_EVENT = "project-delete-settings-changed" as const

export const DEFAULT_QUICK_PROJECT_DELETE = false

const quickProjectDeletePref = booleanBrowserPref({
  keySuffix: "quick-project-delete",
  defaultValue: DEFAULT_QUICK_PROJECT_DELETE,
  changedEvent: PROJECT_DELETE_SETTINGS_CHANGED_EVENT,
})

export const QUICK_PROJECT_DELETE_KEY = quickProjectDeletePref.key

export const readQuickProjectDelete = quickProjectDeletePref.read
export const writeQuickProjectDelete = quickProjectDeletePref.write
