import type { DocRef, InputType } from "@/lib/types"
import { InputType as InputTypeEnum } from "@/lib/types"
import { DocViewMode } from "@/lib/doc-viewer"
import { isMarkupInputType, MarkupKind } from "@/lib/markup-kinds"

type DocMeta = Pick<DocRef, "name" | "type"> | undefined

// AI : markdown uploads and pipeline output snapshots (.md) share the parser + formatted tabs.
export function isMarkdownDoc(doc: DocMeta): boolean {
  if (!doc) return false
  if (doc.type === InputTypeEnum.Markdown) return true
  return doc.name.toLowerCase().endsWith(".md") || doc.name.toLowerCase().endsWith(".markdown")
}

export function isLatexDoc(doc: DocMeta): boolean {
  if (!doc) return false
  if (doc.type === InputTypeEnum.Latex) return true
  const n = doc.name.toLowerCase()
  return n.endsWith(".tex") || n.endsWith(".latex")
}

export function isMarkupDoc(doc: DocMeta): boolean {
  return isMarkdownDoc(doc) || isLatexDoc(doc)
}

export function markupKindForDoc(doc: DocMeta): MarkupKind | null {
  if (isLatexDoc(doc)) return MarkupKind.Latex
  if (isMarkdownDoc(doc)) return MarkupKind.Markdown
  if (doc?.type && isMarkupInputType(doc.type as InputType)) {
    return doc.type === InputTypeEnum.Latex ? MarkupKind.Latex : MarkupKind.Markdown
  }
  return null
}

export function isPdfDoc(doc: DocMeta, hasPdfFile = false): boolean {
  if (isMarkupDoc(doc)) return false
  if (hasPdfFile) return true
  if (doc?.type === InputTypeEnum.Pdf) return true
  return doc?.name.toLowerCase().endsWith(".pdf") ?? false
}

// AI : "parser" = built-in PDF.js / upload text (docs.content). "vision" = cached OCR text.
// AI : TODO ocr-boxes — when convert-to-text stores OcrBox[] (lib/ocr-boxes.ts), append a boxes tab
// AI :   for pdf/image and overlay on the original-bytes blob (no extra encoded copies).
export function docViewerTabs(
  doc: DocMeta,
  hasPdfFile: boolean,
  hasVisionText = false,
): DocViewMode[] {
  if (doc?.type === InputTypeEnum.Json) return [DocViewMode.Json, DocViewMode.Parser]
  if (doc?.type === InputTypeEnum.Excel) return [DocViewMode.Json, DocViewMode.Parser]
  // AI : TODO (media-view-A-docs) — audio/video/model3d → Play tab + parser transcript if content exists.
  if (isMarkupDoc(doc)) return [DocViewMode.Parser, DocViewMode.Formatted]
  if (isPdfDoc(doc, hasPdfFile)) {
    const tabs: DocViewMode[] = [DocViewMode.Parser, DocViewMode.Formatted]
    if (hasPdfFile) tabs.push(DocViewMode.Pdf)
    if (hasVisionText) tabs.push(DocViewMode.Vision)
    return tabs
  }
  const tabs: DocViewMode[] = [DocViewMode.Parser]
  if (hasVisionText) tabs.push(DocViewMode.Vision)
  return tabs
}

export function docViewTabLabel(mode: DocViewMode, doc: DocMeta, hasPdfFile = false): string {
  const pdf = isPdfDoc(doc, hasPdfFile)
  switch (mode) {
    case DocViewMode.Parser:
      return pdf ? "raw" : "built-in"
    case DocViewMode.Formatted:
      return "formatted"
    case DocViewMode.Pdf:
      return "pdf"
    case DocViewMode.Vision:
      return "vision OCR"
    case DocViewMode.Json:
      return doc?.type === InputTypeEnum.Excel ? "table" : "json"
  }
}

export function defaultDocViewMode(
  doc: DocMeta,
  hasPdfFile: boolean,
  opts: { hasSpan: boolean; requested?: DocViewMode; hasVisionText?: boolean },
): DocViewMode {
  const tabs = docViewerTabs(doc, hasPdfFile, opts.hasVisionText)
  if (opts.requested && tabs.includes(opts.requested)) return opts.requested
  if (opts.hasSpan) return DocViewMode.Parser
  if (doc?.type === InputTypeEnum.Json || doc?.type === InputTypeEnum.Excel) return DocViewMode.Json
  if (isPdfDoc(doc, hasPdfFile) && hasPdfFile) return DocViewMode.Pdf
  if (isMarkupDoc(doc)) return DocViewMode.Formatted
  return DocViewMode.Parser
}

// AI : inline step previews — text/markdown/excel only; no pdf iframe or vision OCR tabs.
export function inlineDocViewTabs(doc: DocMeta, hasPdfFile: boolean): DocViewMode[] {
  return docViewerTabs(doc, hasPdfFile, false).filter(
    (m) => m !== DocViewMode.Pdf && m !== DocViewMode.Vision,
  )
}

export function defaultInlineDocViewMode(doc: DocMeta, hasPdfFile: boolean): DocViewMode {
  const tabs = inlineDocViewTabs(doc, hasPdfFile)
  if (doc?.type === InputTypeEnum.Json || doc?.type === InputTypeEnum.Excel) {
    return tabs.includes(DocViewMode.Json) ? DocViewMode.Json : DocViewMode.Parser
  }
  if (isMarkupDoc(doc)) {
    return tabs.includes(DocViewMode.Formatted) ? DocViewMode.Formatted : DocViewMode.Parser
  }
  if (isPdfDoc(doc, hasPdfFile)) {
    return tabs.includes(DocViewMode.Formatted) ? DocViewMode.Formatted : DocViewMode.Parser
  }
  return tabs[0] ?? DocViewMode.Parser
}
