import type { DocId, DocRef, RunStep } from "@/lib/types"
import type { DocViewMode } from "@/lib/doc-viewer"

// AI : resolve the source doc for an input / doc-to-text step — new runs store docId; older runs parse the preview.
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

export function stepDocLinkLabels(doc?: DocRef): {
  input: { mode: DocViewMode; label: string }
  output: { mode: DocViewMode; label: string }
} {
  const isJson = doc?.type === "json"
  const isPdf = doc?.type === "pdf" || doc?.name.toLowerCase().endsWith(".pdf")
  if (isJson) {
    return {
      input: { mode: "json", label: "source json" },
      output: { mode: "json", label: "stored json" },
    }
  }
  if (isPdf) {
    return {
      input: { mode: "pdf", label: "original pdf" },
      output: { mode: "text", label: "converted text" },
    }
  }
  return {
    input: { mode: "text", label: "source document" },
    output: { mode: "text", label: "stored text" },
  }
}
