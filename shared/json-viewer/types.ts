// AI : view ids + defaults — keep in sync with json-viewer.html JV_* constants.

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

// AI : keep in sync with json-viewer.html postMessage types
export const JSON_VIEWER_MESSAGE_LOAD = "json-viewer:load" as const
export const JSON_VIEWER_MESSAGE_SETTINGS = "json-viewer:settings" as const
export const JSON_VIEWER_MESSAGE_FULLSCREEN = "json-viewer:fullscreen" as const

// AI : sample snippet for settings preview — keep in sync with json-viewer.html preview
export const JSON_VIEWER_SYNTAX_PREVIEW =
  '{\n  "rule_id": "R-01",\n  "active": true,\n  "count": 42\n}'

export function isJsonViewerHumanViewId(v: string): v is JsonViewerHumanViewId {
  return JSON_VIEWER_HUMAN_VIEWS.some((x) => x.id === v)
}

export function isJsonViewerSyntaxThemeId(v: string): v is JsonViewerSyntaxThemeId {
  return JSON_VIEWER_SYNTAX_THEMES.some((x) => x.id === v)
}
