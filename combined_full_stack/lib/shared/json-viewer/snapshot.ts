import {
  DEFAULT_JSON_VIEWER_HUMAN_VIEW,
  DEFAULT_JSON_VIEWER_SYNTAX_THEME,
  isJsonViewerHumanViewId,
  isJsonViewerSyntaxThemeId,
  type JsonViewerHumanViewId,
  type JsonViewerSyntaxThemeId,
} from "./types"

// AI : must match the /*JSON_VIEWER_SNAPSHOT_JSON*/ tokens in json-viewer.html
export const JSON_VIEWER_SNAPSHOT_TOKEN = "JSON_VIEWER_SNAPSHOT_JSON"

export type JsonViewerSnapshotTab = {
  id: string
  label: string
  value: unknown
  defaultView?: JsonViewerHumanViewId
}

export type JsonViewerSnapshot = {
  title: string
  subtitle?: string
  defaultView?: JsonViewerHumanViewId
  syntaxTheme?: JsonViewerSyntaxThemeId
  hideHeader?: boolean
  // AI : srcdoc snapshots enable ⛶ the same way embed postMessage sets data-fs
  showFullscreen?: boolean
  tabs: JsonViewerSnapshotTab[]
}

export type JsonViewerExportState = {
  json: unknown
  view?: string
  syntaxTheme?: string
  showFullscreen?: boolean
}

export function jsonViewerExportReady(
  exported: JsonViewerExportState | null | undefined,
): exported is JsonViewerExportState {
  return !!exported && exported.json !== undefined
}

export function jsonViewerSnapshotFromExport(
  exported: JsonViewerExportState,
  opts: { title: string; showFullscreen?: boolean },
): JsonViewerSnapshot {
  const rawView = exported.view ?? ""
  const view = isJsonViewerHumanViewId(rawView) ? rawView : DEFAULT_JSON_VIEWER_HUMAN_VIEW
  const rawTheme = exported.syntaxTheme ?? ""
  return {
    title: opts.title,
    hideHeader: true,
    defaultView: view,
    syntaxTheme: isJsonViewerSyntaxThemeId(rawTheme) ? rawTheme : DEFAULT_JSON_VIEWER_SYNTAX_THEME,
    showFullscreen: opts.showFullscreen ?? exported.showFullscreen === true,
    tabs: [{ id: "output", label: "output", value: exported.json, defaultView: view }],
  }
}

function jsStringLiteral(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

export function injectJsonViewerSnapshot(template: string, snapshot: JsonViewerSnapshot): string {
  const start = `/*${JSON_VIEWER_SNAPSHOT_TOKEN}*/`
  const i = template.indexOf(start)
  const j = i >= 0 ? template.indexOf(start, i + start.length) : -1
  if (i < 0 || j < 0) {
    throw new Error(`JSON viewer template is missing the ${JSON_VIEWER_SNAPSHOT_TOKEN} placeholder`)
  }
  return template.slice(0, i + start.length) + jsStringLiteral(snapshot) + template.slice(j)
}
