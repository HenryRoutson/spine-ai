// AI : DOM helpers for Cursor-style UI select mode (client only).

import {
  type UiContextKind,
  type UiContextRef,
  UI_CONTEXT_KINDS,
  normalizeUiContextRef,
  truncateUiContextText,
  MAX_UI_CONTEXT_LABEL_CHARS,
  MAX_UI_CONTEXT_SNIPPET_CHARS,
  MAX_UI_CONTEXT_FIELD_PATH_CHARS,
} from "@/lib/ui-context-types"

export const UI_CONTEXT_ATTR = {
  kind: "data-ui-context-kind",
  id: "data-ui-context-id",
  label: "data-ui-context-label",
  moduleId: "data-ui-context-module-id",
  fieldPath: "data-ui-context-field-path",
  snippet: "data-ui-context-snippet",
  ignore: "data-ui-context-ignore",
} as const

export const UI_CONTEXT_TARGET_SELECTOR = `[${UI_CONTEXT_ATTR.kind}]`

function isUiContextKind(v: string): v is UiContextKind {
  return (UI_CONTEXT_KINDS as readonly string[]).includes(v)
}

export function uiContextTargetProps(ref: {
  kind: UiContextKind
  id: string
  label: string
  moduleId?: string
  fieldPath?: string
  snippet?: string
}): Record<string, string> {
  const n = normalizeUiContextRef({
    id: ref.id,
    kind: ref.kind,
    label: ref.label,
    moduleId: ref.moduleId,
    fieldPath: ref.fieldPath,
    snippet: ref.snippet,
  })
  const props: Record<string, string> = {
    [UI_CONTEXT_ATTR.kind]: n.kind,
    [UI_CONTEXT_ATTR.id]: n.id,
    [UI_CONTEXT_ATTR.label]: n.label,
  }
  if (n.moduleId) props[UI_CONTEXT_ATTR.moduleId] = n.moduleId
  if (n.fieldPath) props[UI_CONTEXT_ATTR.fieldPath] = n.fieldPath
  if (n.snippet) props[UI_CONTEXT_ATTR.snippet] = n.snippet
  return props
}

export function readUiContextFromElement(el: Element): UiContextRef | null {
  const kindRaw = el.getAttribute(UI_CONTEXT_ATTR.kind)
  const id = el.getAttribute(UI_CONTEXT_ATTR.id)
  const label = el.getAttribute(UI_CONTEXT_ATTR.label)
  if (!kindRaw || !isUiContextKind(kindRaw) || !id || !label) return null
  return normalizeUiContextRef({
    id,
    kind: kindRaw,
    label: truncateUiContextText(label, MAX_UI_CONTEXT_LABEL_CHARS),
    moduleId: el.getAttribute(UI_CONTEXT_ATTR.moduleId) ?? undefined,
    fieldPath: truncateUiContextText(
      el.getAttribute(UI_CONTEXT_ATTR.fieldPath) ?? "",
      MAX_UI_CONTEXT_FIELD_PATH_CHARS,
    ) || undefined,
    snippet: truncateUiContextText(
      el.getAttribute(UI_CONTEXT_ATTR.snippet) ?? "",
      MAX_UI_CONTEXT_SNIPPET_CHARS,
    ) || undefined,
  })
}

export function findUiContextTargetAtPoint(x: number, y: number): Element | null {
  const stack = document.elementsFromPoint(x, y)
  for (const el of stack) {
    if (!(el instanceof Element)) continue
    // AI : skip ignore regions entirely, then take nearest marked ancestor of remaining hits.
    if (el.closest(`[${UI_CONTEXT_ATTR.ignore}]`)) continue
    const target = el.closest(UI_CONTEXT_TARGET_SELECTOR)
    if (!target) continue
    if (target.closest(`[${UI_CONTEXT_ATTR.ignore}]`)) continue
    return target
  }
  return null
}
