import type { DocRef } from "@/lib/types"
import type { DocViewMode } from "@/lib/doc-viewer"

type DocMeta = Pick<DocRef, "name" | "type"> | undefined

// AI : markdown uploads and pipeline output snapshots (.md) share the parser + formatted tabs.
export function isMarkdownDoc(doc: DocMeta): boolean {
  return doc?.name.toLowerCase().endsWith(".md") ?? false
}

export function isPdfDoc(doc: DocMeta, hasPdfFile = false): boolean {
  if (isMarkdownDoc(doc)) return false
  if (hasPdfFile) return true
  if (doc?.type === "pdf") return true
  return doc?.name.toLowerCase().endsWith(".pdf") ?? false
}

// AI : "parser" = built-in PDF.js / upload text (docs.content). "vision" = cached OpenRouter OCR.
export function docViewerTabs(
  doc: DocMeta,
  hasPdfFile: boolean,
  hasVisionText = false,
): DocViewMode[] {
  if (doc?.type === "json") return ["json", "parser"]
  if (doc?.type === "excel") return ["json", "parser"]
  if (isMarkdownDoc(doc)) return ["parser", "formatted"]
  if (isPdfDoc(doc, hasPdfFile)) {
    const tabs: DocViewMode[] = ["parser", "formatted"]
    if (hasPdfFile) tabs.push("pdf")
    if (hasVisionText) tabs.push("vision")
    return tabs
  }
  const tabs: DocViewMode[] = ["parser"]
  if (hasVisionText) tabs.push("vision")
  return tabs
}

export function docViewTabLabel(mode: DocViewMode, doc: DocMeta, hasPdfFile = false): string {
  const pdf = isPdfDoc(doc, hasPdfFile)
  switch (mode) {
    case "parser":
      return pdf ? "raw" : "built-in"
    case "formatted":
      return "formatted"
    case "pdf":
      return "pdf"
    case "vision":
      return "vision OCR"
    case "json":
      return doc?.type === "excel" ? "table" : "json"
  }
}

export function defaultDocViewMode(
  doc: DocMeta,
  hasPdfFile: boolean,
  opts: { hasSpan: boolean; requested?: DocViewMode; hasVisionText?: boolean },
): DocViewMode {
  const tabs = docViewerTabs(doc, hasPdfFile, opts.hasVisionText)
  if (opts.requested && tabs.includes(opts.requested)) return opts.requested
  if (opts.hasSpan) return "parser"
  if (doc?.type === "json" || doc?.type === "excel") return "json"
  if (isPdfDoc(doc, hasPdfFile) && hasPdfFile) return "pdf"
  if (isMarkdownDoc(doc)) return "formatted"
  return "parser"
}
