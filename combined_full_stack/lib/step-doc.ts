import { InputType } from "@/lib/types"
import type { DocId, DocRef, RunStep } from "@/lib/types"
import type { DocViewMode } from "@/lib/doc-viewer"
import { isMarkdownDoc, isLatexDoc, isPdfDoc } from "@/lib/doc-content"
import { isJsonText } from "@shared/json-viewer/is-json-text"

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

function docIdFromPreviewText(text: string): DocId | undefined {
  const m = text.match(/(sha_[a-f0-9]+)/)
  return m?.[1]?.startsWith("sha_") ? (m[1] as DocId) : undefined
}

// AI : all source docs for an input step — powers inline file preview in logging + inference.
export function stepInputDocIds(step: RunStep): DocId[] {
  if (step.kind !== "input") return []
  if (step.inputPreviewItems?.length) {
    const fromItems = step.inputPreviewItems
      .map((item) => docIdFromPreviewText(item.text))
      .filter((id): id is DocId => id != null)
    if (fromItems.length) return fromItems
  }
  if (step.outputJson) {
    try {
      const o = JSON.parse(step.outputJson) as { doc_ids?: string[]; doc_id?: string }
      if (o.doc_ids?.length) {
        return o.doc_ids.filter((id): id is DocId => id.startsWith("sha_"))
      }
      if (o.doc_id?.startsWith("sha_")) return [o.doc_id as DocId]
    } catch {
      /* ignore */
    }
  }
  const single = stepDocId(step)
  return single ? [single] : []
}

// AI : input steps store spine metadata in outputJson — not user-visible output.
export function isDocReferenceOutputJson(json?: string): boolean {
  if (!json?.trim()) return false
  try {
    const o = JSON.parse(json) as Record<string, unknown>
    const keys = Object.keys(o)
    if (keys.length === 1 && keys[0] === "doc_id") {
      return typeof o.doc_id === "string" && (o.doc_id as string).startsWith("sha_")
    }
    if (keys.length === 2 && keys.includes("doc_ids") && keys.includes("doc_names")) {
      return Array.isArray(o.doc_ids)
    }
    return false
  } catch {
    return false
  }
}

export function resolveDocRef(docs: DocRef[], docId: DocId): Pick<DocRef, "id" | "name" | "type"> {
  return docs.find((d) => d.id === docId) ?? { id: docId, name: docId, type: InputType.Text }
}

type StepOutputLike = {
  kind?: string
  outputJson?: string
  outputPreview?: string
}

// AI : spreadsheet JSON for the simple logging view — no prompts, text, or doc-id refs.
export function stepSpreadsheetJson(step: StepOutputLike): string | undefined {
  const json = step.outputJson?.trim()
  if (!json || !isJsonText(json) || isDocReferenceOutputJson(json)) return undefined
  return json
}

// AI : true when a step has user-visible output (excludes input doc_id spine refs).
export function hasDisplayableStepOutput(step: StepOutputLike): boolean {
  if (step.kind === "input") return false
  if (step.outputJson && isDocReferenceOutputJson(step.outputJson)) return false
  return !!(step.outputJson?.trim() || step.outputPreview?.trim())
}

// AI : pipeline output steps only — inference tab hero panel after a run.
export function pipelineFinalOutputSteps(steps: RunStep[]): RunStep[] {
  return steps.filter((s) => s.kind === "output" && hasDisplayableStepOutput(s))
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
  if (isLatexDoc(doc)) {
    return {
      input: { mode: "formatted", label: "formatted latex" },
      output: { mode: "formatted", label: "formatted latex" },
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
