// AI : Building stays in chrome by default — Hide developer tools only drops numbered editor tabs.
// AI : On a website, that toggle is page vs backend peek (not pipeline DAG).
// AI : TODO (opt-browser-tui-pref) — optional sibling pref: surface "gui" | "tui" (default gui), same
// AI :   booleanBrowserPref / useBrowserPrefEvent pattern. Not developer-tools; a chrome mode switch.

import { booleanBrowserPref } from "@/lib/browser-storage-pref"
import { useBrowserPrefEvent } from "@/lib/use-browser-pref-event"

export const DEVELOPER_TOOLS_SETTINGS_CHANGED_EVENT = "developer-tools-settings-changed" as const

export const DEFAULT_HIDE_DEVELOPER_TOOLS = false

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
