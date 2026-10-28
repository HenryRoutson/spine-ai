// AI : DOM helpers for Cursor-style UI select mode (client only).
// AI : picks the smallest leaf (cell/label/file), pierces json-viewer iframes, inherits marked ancestors.

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

const IGNORE_SELECTOR = `[${UI_CONTEXT_ATTR.ignore}]`
const HUGE_AREA_PX = 280_000
const UTILITY_CLASS = /^(flex|grid|inline|block|min-|max-|w-|h-|p[xytblr]?-|m[xytblr]?-|gap-|text-|bg-|border|rounded|overflow|relative|absolute|sticky|inset|top-|left-|right-|bottom-|items-|justify-|self-|shrink-|grow-|font-|leading-|tracking-|shadow|ring-|outline|transition|select-|cursor-|whitespace-|truncate|opacity-|z-|sm:|md:|lg:|xl:|dark:|hover:|focus:|group)/

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

function visibleText(el: Element | null | undefined, max: number): string {
  if (!el) return ""
  const t = ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim()
  return truncateUiContextText(t, max)
}

function pickHash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function hostingFrame(el: Element): Element | null {
  const win = el.ownerDocument.defaultView
  const frame = win ? win.frameElement : null
  return frame instanceof Element ? frame : null
}

function iframeAtPoint(iframe: HTMLIFrameElement, parentX: number, parentY: number): { doc: Document; x: number; y: number } | null {
  try {
    const doc = iframe.contentDocument
    if (!doc) return null
    const r = iframe.getBoundingClientRect()
    return { doc, x: parentX - r.left, y: parentY - r.top }
  } catch {
    return null
  }
}

function closestMarked(el: Element): Element | null {
  const local = el.closest(UI_CONTEXT_TARGET_SELECTOR)
  if (local) return local
  const frame = hostingFrame(el)
  return frame ? closestMarked(frame) : null
}

function ignored(el: Element): boolean {
  if (el.closest(IGNORE_SELECTOR)) return true
  const frame = hostingFrame(el)
  return frame ? ignored(frame) : false
}

function headerName(table: HTMLTableElement, col: number): string {
  const headRow = table.tHead?.rows[0] ?? table.querySelector("tr")
  const cell = headRow?.cells[col]
  const raw = visibleText(cell, 80)
  if (!raw || raw === "#" || /^\d+$/.test(raw)) return `col ${col + 1}`
  return raw
}

function rowCellsSummary(row: HTMLTableRowElement, table: HTMLTableElement): string {
  const parts: string[] = []
  for (let i = 0; i < row.cells.length; i++) {
    const cell = row.cells[i]!
    if (cell.classList.contains("td-num-idx")) continue
    const value = visibleText(cell, 120)
    if (!value) continue
    parts.push(`${headerName(table, i)}=${value}`)
  }
  return parts.join(" · ")
}

function tablePick(el: Element): { fieldPath: string; label: string; detail: string; idSuffix: string } | null {
  const cell = el.closest("td, th") as HTMLTableCellElement | null
  const rowEl = el.closest("tr") as HTMLTableRowElement | null
  const table = (cell ?? rowEl)?.closest("table") as HTMLTableElement | null
  if (!table) return null

  if (cell?.classList.contains("td-num-idx") && rowEl) {
    const rowNum = rowEl.sectionRowIndex >= 0 ? rowEl.sectionRowIndex + 1 : rowEl.rowIndex
    const summary = rowCellsSummary(rowEl, table)
    return {
      fieldPath: `row:${rowNum}`,
      label: `row ${rowNum}`,
      detail: summary ? `row ${rowNum}: ${summary}` : `row ${rowNum}`,
      idSuffix: `r${rowNum}`,
    }
  }

  if (cell) {
    const col = cell.cellIndex
    const row = cell.parentElement as HTMLTableRowElement | null
    const rowNum = row ? (row.sectionRowIndex >= 0 ? row.sectionRowIndex + 1 : row.rowIndex) : 0
    const colName = cell.tagName === "TH" ? visibleText(cell, 80) || `col ${col + 1}` : headerName(table, col)
    const value = visibleText(cell, 240)
    const isHeader = cell.tagName === "TH"
    const fieldPath = isHeader ? `header:${colName}` : `row:${rowNum}:${colName}`
    return {
      fieldPath,
      label: isHeader ? `column ${colName}` : `${colName}: ${truncateUiContextText(value, 48) || "empty"}`,
      detail: isHeader
        ? `column ${colName}`
        : `row ${rowNum} · ${colName} = ${value || "empty"}`,
      idSuffix: isHeader ? `h${col}` : `r${rowNum}c${col}`,
    }
  }

  if (rowEl) {
    const rowNum = rowEl.sectionRowIndex >= 0 ? rowEl.sectionRowIndex + 1 : rowEl.rowIndex
    const summary = rowCellsSummary(rowEl, table)
    return {
      fieldPath: `row:${rowNum}`,
      label: `row ${rowNum}`,
      detail: summary ? `row ${rowNum}: ${summary}` : `row ${rowNum}`,
      idSuffix: `r${rowNum}`,
    }
  }
  return null
}

function cssPath(el: Element): string {
  const parts: string[] = []
  let cur: Element | null = el
  for (let i = 0; i < 6 && cur && cur.tagName !== "HTML"; i++) {
    const tag = cur.tagName.toLowerCase()
    const id = cur.id ? `#${cur.id}` : ""
    const spine = cur.getAttribute("data-spine-id")
    const ctxId = cur.getAttribute(UI_CONTEXT_ATTR.id)
    const named = spine ? `[data-spine-id=${spine}]` : ctxId ? `[${UI_CONTEXT_ATTR.id}=${ctxId}]` : ""
    let cls = ""
    if (!id && !named) {
      for (const c of cur.classList) {
        if (c.length < 28 && !UTILITY_CLASS.test(c)) {
          cls = `.${c}`
          break
        }
      }
    }
    parts.unshift(`${tag}${id}${named}${cls}`)
    cur = cur.parentElement ?? hostingFrame(cur)
  }
  return parts.join(" > ")
}

function compactHtml(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const bits: string[] = []
  for (const a of ["id", "aria-label", "title", "data-spine-id", UI_CONTEXT_ATTR.id, UI_CONTEXT_ATTR.label] as const) {
    const v = el.getAttribute(a)
    if (v) bits.push(`${a}="${truncateUiContextText(v, 48)}"`)
  }
  const text = visibleText(el, 100)
  return `<${tag}${bits.length ? ` ${bits.join(" ")}` : ""}>${text}</${tag}>`
}

type LeafDetail = {
  label: string
  snippet: string
  fieldPath?: string
  idSuffix: string
}

function describeLeaf(el: Element): LeafDetail {
  const cell = tablePick(el)
  const text = visibleText(el, 500)
  const aria = (el.getAttribute("aria-label") || el.getAttribute("title") || "").trim()
  const path = cssPath(el)
  const html = compactHtml(el)
  const label = cell?.label ?? truncateUiContextText(text || aria || el.tagName.toLowerCase(), 80)
  const lines = [
    cell?.detail ? `picked: ${cell.detail}` : text ? `picked: ${text}` : null,
    aria && aria !== text ? `aria: ${aria}` : null,
    `path: ${path}`,
    `html: ${html}`,
  ].filter(Boolean)
  return {
    label,
    snippet: truncateUiContextText(lines.join("\n"), MAX_UI_CONTEXT_SNIPPET_CHARS),
    fieldPath: cell?.fieldPath,
    idSuffix: cell?.idSuffix ?? pickHash(`${path}\n${text}`).slice(0, 10),
  }
}

function isNoisy(el: Element): boolean {
  const tag = el.tagName
  return tag === "SVG" || tag === "PATH" || tag === "BR" || tag === "SCRIPT" || tag === "STYLE"
}

function pickSelectLeaf(start: Element): Element | null {
  if (ignored(start) || isNoisy(start)) return null
  const cell = start.closest("td, th")
  if (cell && !ignored(cell)) return cell
  const row = start.closest("tr")
  if (row && !ignored(row) && start.closest("table")) return row

  let cur: Element | null = start
  let candidate: Element | null = null
  for (let i = 0; i < 10 && cur; i++) {
    const tag = cur.tagName
    if (tag === "HTML" || tag === "BODY" || tag === "IFRAME") break
    if (ignored(cur)) return null
    if (isNoisy(cur)) {
      cur = cur.parentElement
      continue
    }
    const r = cur.getBoundingClientRect()
    const area = r.width * r.height
    if (r.width < 4 || r.height < 4) {
      cur = cur.parentElement
      continue
    }
    if (area > HUGE_AREA_PX) break
    if (cur.matches("button, a, p, li, h1, h2, h3, h4, label, [role='button'], [role='row'], [role='cell']")) {
      return candidate ?? cur
    }
    const text = visibleText(cur, 400)
    if (text.length >= 1) candidate = cur
    const parent = cur.parentElement
    if (parent && candidate) {
      const pr = parent.getBoundingClientRect()
      if (pr.width * pr.height > area * 8) break
    }
    cur = parent
  }
  if (candidate) return candidate
  const marked = closestMarked(start)
  return marked && !ignored(marked) ? marked : null
}

function findInDocument(doc: Document, x: number, y: number): Element | null {
  let stack: Element[]
  try {
    stack = doc.elementsFromPoint(x, y)
  } catch {
    return null
  }
  for (const el of stack) {
    if (!(el instanceof Element)) continue
    if (el.closest(IGNORE_SELECTOR)) continue
    if (el instanceof HTMLIFrameElement) {
      const inner = pierceIframe(el, x, y)
      if (inner) return inner
      continue
    }
    const leaf = pickSelectLeaf(el)
    if (leaf) return leaf
  }
  return null
}

function pierceIframe(iframe: HTMLIFrameElement, parentX: number, parentY: number): Element | null {
  const hit = iframeAtPoint(iframe, parentX, parentY)
  if (!hit) return null
  return findInDocument(hit.doc, hit.x, hit.y)
}

export function findUiContextTargetAtPoint(x: number, y: number): Element | null {
  return findInDocument(document, x, y)
}

export function readMarkedUiContext(el: Element): UiContextRef | null {
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

export function readUiContextFromElement(el: Element): UiContextRef | null {
  const detail = describeLeaf(el)
  const marked = closestMarked(el)
  const base = marked ? readMarkedUiContext(marked) : null
  if (base && marked === el) return base
  if (base) {
    const fieldPath = detail.fieldPath ?? base.fieldPath
    return normalizeUiContextRef({
      ...base,
      id: `${base.id}#${detail.idSuffix}`,
      label: truncateUiContextText(`${base.label} · ${detail.label}`, MAX_UI_CONTEXT_LABEL_CHARS),
      fieldPath,
      snippet: [detail.snippet, base.snippet].filter(Boolean).join("\n\n"),
    })
  }
  if (!detail.snippet) return null
  return normalizeUiContextRef({
    id: `ui:${detail.idSuffix}`,
    kind: "generic",
    label: detail.label || "UI",
    fieldPath: detail.fieldPath,
    snippet: detail.snippet,
  })
}

export function viewportRectOf(el: Element): { top: number; left: number; width: number; height: number } {
  const r = el.getBoundingClientRect()
  let top = r.top
  let left = r.left
  let node: Element | null = el
  for (let i = 0; i < 6 && node; i++) {
    const frame = hostingFrame(node)
    if (!frame) break
    const fr = frame.getBoundingClientRect()
    top += fr.top
    left += fr.left
    node = frame
  }
  return { top, left, width: Math.max(r.width, 4), height: Math.max(r.height, 4) }
}

export function topLevelPointFromEvent(e: PointerEvent): { x: number; y: number } {
  let x = e.clientX
  let y = e.clientY
  let view: Window | null =
    e.view ?? (e.target instanceof Node ? e.target.ownerDocument?.defaultView ?? null : null)
  while (view && view !== window) {
    const frame = view.frameElement
    if (!(frame instanceof Element)) break
    const fr = frame.getBoundingClientRect()
    x += fr.left
    y += fr.top
    view = frame.ownerDocument.defaultView
  }
  return { x, y }
}

export function sameOriginIframes(root: Document = document): HTMLIFrameElement[] {
  const out: HTMLIFrameElement[] = []
  for (const iframe of root.querySelectorAll("iframe")) {
    try {
      if (iframe.contentDocument) out.push(iframe)
    } catch {
      /* cross-origin */
    }
  }
  return out
}
