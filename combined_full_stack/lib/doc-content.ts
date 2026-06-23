import type { DocRef } from "@/lib/types"
import type { DocViewMode } from "@/lib/doc-viewer"

type DocMeta = Pick<DocRef, "name" | "type"> | undefined

// AI : markdown uploads and pipeline output snapshots (.md) share the text + formatted tabs.
export function isMarkdownDoc(doc: DocMeta): boolean {
  return doc?.name.toLowerCase().endsWith(".md") ?? false
}

export function isPdfDoc(doc: DocMeta, hasPdfFile = false): boolean {
  if (isMarkdownDoc(doc)) return false
  if (hasPdfFile) return true
  if (doc?.type === "pdf") return true
  return doc?.name.toLowerCase().endsWith(".pdf") ?? false
}

export function docViewerTabs(doc: DocMeta, hasPdfFile: boolean): DocViewMode[] {
  if (doc?.type === "json") return ["json", "text"]
  if (isMarkdownDoc(doc)) return ["text", "formatted"]
  if (isPdfDoc(doc, hasPdfFile) && hasPdfFile) return ["text", "formatted", "pdf"]
  return []
}

export function defaultDocViewMode(
  doc: DocMeta,
  hasPdfFile: boolean,
  opts: { hasSpan: boolean; requested?: DocViewMode },
): DocViewMode {
  const tabs = docViewerTabs(doc, hasPdfFile)
  if (opts.requested && tabs.includes(opts.requested)) return opts.requested
  if (opts.hasSpan) return "text"
  if (doc?.type === "json") return "json"
  if (isPdfDoc(doc, hasPdfFile) && hasPdfFile) return "pdf"
  if (isMarkdownDoc(doc)) return "formatted"
  return "text"
}
