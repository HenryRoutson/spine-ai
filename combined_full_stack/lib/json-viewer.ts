// AI : shared JSON viewer settings — keep localStorage key + view ids in sync with public/json-viewer.html

import { stringBrowserPref } from "@/lib/browser-storage-pref"

export type JsonViewerHumanViewId = "tree" | "table" | "json"
export type JsonViewerSyntaxThemeId = "app" | "vscode"

export const JSON_VIEWER_HUMAN_VIEWS: readonly {
  id: JsonViewerHumanViewId
  label: string
  description: string
}[] = [
  { id: "tree", label: "Tree", description: "Indented outline — expand fields in place" },
  { id: "table", label: "Table", description: "Spreadsheet-style rows for list-shaped data" },
  { id: "json", label: "JSON", description: "Compact syntax view with foldable blocks" },
] as const

export const DEFAULT_JSON_VIEWER_HUMAN_VIEW: JsonViewerHumanViewId = "tree"

export const JSON_VIEWER_SYNTAX_THEMES: readonly {
  id: JsonViewerSyntaxThemeId
  label: string
  description: string
}[] = [
  { id: "app", label: "App", description: "Pipeline / log output — green strings, blue keys, orange numbers" },
  { id: "vscode", label: "Editor", description: "Classic code editor — peach strings, cyan keys" },
] as const

export const DEFAULT_JSON_VIEWER_SYNTAX_THEME: JsonViewerSyntaxThemeId = "app"

export const JSON_VIEWER_SETTINGS_CHANGED_EVENT = "json-viewer-settings-changed" as const

// AI : sample snippet for settings preview — keep in sync with json-viewer.html preview
export const JSON_VIEWER_SYNTAX_PREVIEW =
  '{\n  "rule_id": "R-01",\n  "active": true,\n  "count": 42\n}'

export function isJsonViewerHumanViewId(v: string): v is JsonViewerHumanViewId {
  return JSON_VIEWER_HUMAN_VIEWS.some((x) => x.id === v)
}

const defaultViewPref = stringBrowserPref({
  keySuffix: "json-viewer-default-view",
  defaultValue: DEFAULT_JSON_VIEWER_HUMAN_VIEW,
  changedEvent: JSON_VIEWER_SETTINGS_CHANGED_EVENT,
  isValid: isJsonViewerHumanViewId,
})

export const JSON_VIEWER_DEFAULT_VIEW_KEY = defaultViewPref.key
export const readJsonViewerDefaultView = defaultViewPref.read
export const writeJsonViewerDefaultView = defaultViewPref.write

export function isJsonViewerSyntaxThemeId(v: string): v is JsonViewerSyntaxThemeId {
  return JSON_VIEWER_SYNTAX_THEMES.some((x) => x.id === v)
}

const syntaxThemePref = stringBrowserPref({
  keySuffix: "json-viewer-syntax-theme",
  defaultValue: DEFAULT_JSON_VIEWER_SYNTAX_THEME,
  changedEvent: JSON_VIEWER_SETTINGS_CHANGED_EVENT,
  isValid: isJsonViewerSyntaxThemeId,
})

export const JSON_VIEWER_SYNTAX_THEME_KEY = syntaxThemePref.key
export const readJsonViewerSyntaxTheme = syntaxThemePref.read
export const writeJsonViewerSyntaxTheme = syntaxThemePref.write
