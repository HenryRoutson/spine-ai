// AI : shared JSON viewer settings — keep localStorage key + view ids in sync with public/json-viewer.html

import { appStorageKey } from "@/lib/storage-keys"

export const JSON_VIEWER_DEFAULT_VIEW_KEY = appStorageKey("json-viewer-default-view")
export const JSON_VIEWER_SYNTAX_THEME_KEY = appStorageKey("json-viewer-syntax-theme")

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

export function readJsonViewerDefaultView(): JsonViewerHumanViewId {
  if (typeof window === "undefined") return DEFAULT_JSON_VIEWER_HUMAN_VIEW
  try {
    const v = localStorage.getItem(JSON_VIEWER_DEFAULT_VIEW_KEY)
    if (v && isJsonViewerHumanViewId(v)) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_JSON_VIEWER_HUMAN_VIEW
}

export function writeJsonViewerDefaultView(view: JsonViewerHumanViewId): void {
  localStorage.setItem(JSON_VIEWER_DEFAULT_VIEW_KEY, view)
  window.dispatchEvent(new Event(JSON_VIEWER_SETTINGS_CHANGED_EVENT))
}

export function isJsonViewerSyntaxThemeId(v: string): v is JsonViewerSyntaxThemeId {
  return JSON_VIEWER_SYNTAX_THEMES.some((x) => x.id === v)
}

export function readJsonViewerSyntaxTheme(): JsonViewerSyntaxThemeId {
  if (typeof window === "undefined") return DEFAULT_JSON_VIEWER_SYNTAX_THEME
  try {
    const v = localStorage.getItem(JSON_VIEWER_SYNTAX_THEME_KEY)
    if (v && isJsonViewerSyntaxThemeId(v)) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_JSON_VIEWER_SYNTAX_THEME
}

export function writeJsonViewerSyntaxTheme(theme: JsonViewerSyntaxThemeId): void {
  localStorage.setItem(JSON_VIEWER_SYNTAX_THEME_KEY, theme)
  window.dispatchEvent(new Event(JSON_VIEWER_SETTINGS_CHANGED_EVENT))
}
