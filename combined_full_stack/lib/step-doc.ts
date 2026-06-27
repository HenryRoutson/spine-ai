import type { DocId, DocRef, RunStep } from "@/lib/types"
import type { DocViewMode } from "@/lib/doc-viewer"
import { isMarkdownDoc, isPdfDoc } from "@/lib/doc-content"

// AI : resolve the source doc for an input step — new runs store docId; older runs parse the preview.
export function stepDocId(step: RunStep): DocId | undefined {
  if (step.docId) return step.docId
  if (step.outputJson) {
    try {
      const o = JSON.parse(step.outputJson) as { doc_id?: string }
      if (o.doc_id?.startsWith("sha_")) return o.doc_id as DocId
    } catch {
      /* ignore */
    }
  }
  const m = step.outputPreview.match(/→ (sha_[a-f0-9]+)/)
  return m ? (m[1] as DocId) : undefined
}

// AI : resolve source doc from SOURCE DOCUMENT (sha_…, N chars): blocks in step input previews.
export function sourceDocIdFromPreview(text: string): DocId | undefined {
  const m = text.match(/SOURCE DOCUMENT \(([^,)]+)/)
  return m?.[1]?.startsWith("sha_") ? (m[1] as DocId) : undefined
}

export function stepSourceDocId(step: RunStep): DocId | undefined {
  return stepDocId(step) ?? sourceDocIdFromPreview(step.inputPreview)
}

export function stepDocLinkLabels(doc?: DocRef): {
  input: { mode: DocViewMode; label: string }
  output: { mode: DocViewMode; label: string }
} {
  if (doc?.type === "json") {
    return {
      input: { mode: "json", label: "source json" },
      output: { mode: "json", label: "stored json" },
    }
  }
  if (isMarkdownDoc(doc)) {
    return {
      input: { mode: "formatted", label: "formatted markdown" },
      output: { mode: "formatted", label: "formatted markdown" },
    }
  }
  if (isPdfDoc(doc)) {
    return {
      input: { mode: "pdf", label: "original pdf" },
      output: { mode: "formatted", label: "converted markdown" },
    }
  }
  return {
    input: { mode: "parser", label: "built-in parser" },
    output: { mode: "parser", label: "stored parser text" },
  }
}
