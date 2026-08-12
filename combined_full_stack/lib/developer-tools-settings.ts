// AI : vibe-first default — hide Build / technical editors unless the user opts in.

import { booleanBrowserPref } from "@/lib/browser-storage-pref"
import { useBrowserPrefEvent } from "@/lib/use-browser-pref-event"

export const DEVELOPER_TOOLS_SETTINGS_CHANGED_EVENT = "developer-tools-settings-changed" as const

export const DEFAULT_HIDE_DEVELOPER_TOOLS = true

const hideDeveloperToolsPref = booleanBrowserPref({
  keySuffix: "hide-developer-tools",
  defaultValue: DEFAULT_HIDE_DEVELOPER_TOOLS,
  changedEvent: DEVELOPER_TOOLS_SETTINGS_CHANGED_EVENT,
})

export const HIDE_DEVELOPER_TOOLS_KEY = hideDeveloperToolsPref.key

export const readHideDeveloperTools = hideDeveloperToolsPref.read
export const writeHideDeveloperTools = hideDeveloperToolsPref.write

export function useHideDeveloperTools(): boolean {
  return useBrowserPrefEvent(DEVELOPER_TOOLS_SETTINGS_CHANGED_EVENT, readHideDeveloperTools)
}
