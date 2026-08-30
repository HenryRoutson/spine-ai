import { escapeHtml } from "@/lib/standalone-html"
import { HOSTED_SITE_IGNORED_SLOT_SELECTOR } from "@/lib/hosted-site-slots"

export const HS_PREVIEW_MESSAGE_SOURCE = "spine-hosted-site"

// AI : HTML slots plus React host widgets (bolt inspector ignores the preview iframe chrome).
export const HS_PREVIEW_IGNORED_SELECTOR = `${HOSTED_SITE_IGNORED_SLOT_SELECTOR}, [data-spine-run], [data-spine-slot], [data-spine-sql], [data-spine-action]`

export function isHsPreviewIgnoredTarget(el: Element): boolean {
  return Boolean(el.closest(HS_PREVIEW_IGNORED_SELECTOR))
}

export type hs_preview_css_path = string & { __brand: "hs_preview_css_path" }
export type hs_preview_hs_id = string & { __brand: "hs_preview_hs_id" }

export type HsPreviewSelectPayload = {
  source: typeof HS_PREVIEW_MESSAGE_SOURCE
  kind: "select"
  cssPath: hs_preview_css_path
  hsId: hs_preview_hs_id
  snippet: string
  text: string
  filePath?: string
}

export type HsPreviewInlinePayload = {
  source: typeof HS_PREVIEW_MESSAGE_SOURCE
  kind: "inline"
  cssPath: hs_preview_css_path
  hsId: hs_preview_hs_id
  text: string
  previousText?: string
  filePath?: string
}

export type HsPreviewMessage = HsPreviewSelectPayload | HsPreviewInlinePayload

const OPEN_TAG_RE = /<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?>/g

export function stampHostedSiteHsIds(html: string): string {
  let n = 0
  return html.replace(OPEN_TAG_RE, (full, tag: string, attrs = "") => {
    if (/\sdata-hs-id=/.test(full)) return full
    n += 1
    const selfClose = /\s*\/>$/.test(full)
    const idAttr = ` data-hs-id="${n}"`
    if (selfClose) {
      return `<${tag}${attrs}${idAttr} />`
    }
    return `<${tag}${attrs}${idAttr}>`
  })
}

export function stripHostedSiteHsIds(html: string): string {
  return html.replace(/\sdata-hs-id="[^"]*"/g, "")
}

export function patchHostedSiteHtmlText(sourceHtml: string, hsId: string, newText: string): string {
  const stamped = stampHostedSiteHsIds(sourceHtml)
  const openRe = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)([^>]*\\sdata-hs-id="${hsId}"[^>]*)>`)
  const m = openRe.exec(stamped)
  if (!m || m.index == null) return sourceHtml
  const tag = m[1]
  if (!tag) return sourceHtml
  const innerStart = m.index + m[0].length
  const close = `</${tag}>`
  const innerEnd = stamped.indexOf(close, innerStart)
  if (innerEnd < 0) return sourceHtml
  const patched = `${stamped.slice(0, innerStart)}${escapeHtml(newText)}${stamped.slice(innerEnd)}`
  return stripHostedSiteHsIds(patched)
}

export function isHsPreviewMessage(data: unknown): data is HsPreviewMessage {
  if (!data || typeof data !== "object") return false
  const o = data as Partial<HsPreviewMessage>
  return o.source === HS_PREVIEW_MESSAGE_SOURCE && (o.kind === "select" || o.kind === "inline")
}

export function previewHtmlRoot(el: Element): Element | null {
  const root = el.closest(".hs-root")
  if (!root) return null
  for (const child of Array.from(root.children)) {
    if (child.tagName === "STYLE") continue
    if (child.classList.contains("hs-foot")) continue
    if (child.matches(HOSTED_SITE_IGNORED_SLOT_SELECTOR)) continue
    if (child.contains(el) || child === el) return child
  }
  return null
}

export function cssPathFromElement(el: Element, root: Element): hs_preview_css_path {
  const parts: string[] = []
  let cur: Element | null = el
  while (cur && cur !== root) {
    const parent: Element | null = cur.parentElement
    if (!parent) break
    const tag = cur.tagName.toLowerCase()
    const className = cur.classList.item(0)
    const cls = className ? `.${cssEscapeIdent(className)}` : ""
    const sameTag: Element[] = Array.from(parent.children).filter((child) => child.tagName === cur!.tagName)
    const idx = sameTag.indexOf(cur) + 1
    parts.unshift(sameTag.length > 1 ? `${tag}${cls}:nth-of-type(${idx})` : `${tag}${cls}`)
    cur = parent
  }
  return parts.join(" > ") as hs_preview_css_path
}

function cssEscapeIdent(raw: string): string {
  return raw.replace(/([^\w-])/g, "\\$1")
}

export function snippetFromElement(el: Element): string {
  const html = el.outerHTML.replace(/\sdata-hs-id="[^"]*"/g, "").replace(/\sdata-hs-selected="[^"]*"/g, "")
  return html.length > 800 ? `${html.slice(0, 799)}…` : html
}

export function patchHostedSiteHtmlUniqueText(sourceHtml: string, oldText: string, newText: string): string | null {
  const needle = oldText.trim()
  const next = newText.trim()
  if (!needle || needle === next) return null
  let count = 0
  let from = 0
  while (from <= sourceHtml.length) {
    const at = sourceHtml.indexOf(needle, from)
    if (at < 0) break
    count += 1
    from = at + needle.length
    if (count > 1) return null
  }
  if (count !== 1) return null
  return sourceHtml.replace(needle, next)
}

export function postHsPreviewMessage(payload: HsPreviewMessage): void {
  window.postMessage(payload, window.location.origin)
}
