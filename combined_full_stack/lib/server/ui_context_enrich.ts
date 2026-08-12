// AI : fill @ / Select UI pins with store-backed content before the LLM prompt (never trust client snippets alone).

import {
  dedupeUiContextRefs,
  normalizeUiContextRef,
  truncateUiContextText,
  MAX_UI_CONTEXT_SNIPPET_CHARS,
  type UiContextRef,
} from "@/lib/ui-context-types"
import type { Store } from "./store"
import type { DocId, Project } from "./types"

function docIdFromRef(ref: UiContextRef): DocId | null {
  const raw = ref.id.startsWith("doc:") ? ref.id.slice(4) : ref.id
  if (!raw.trim()) return null
  return raw as DocId
}

function modelIdFromRef(ref: UiContextRef): string {
  if (ref.id.startsWith("model:")) return ref.id.slice(6)
  // AI : legacy Select UI ids before model: prefix.
  if (ref.id.startsWith("struct:")) return ref.id.slice(7)
  return ref.id
}

function typeIdFromRef(ref: UiContextRef): string {
  if (ref.id.startsWith("type:")) return ref.id.slice(5)
  if (ref.id.startsWith("typealias:")) return ref.id.slice(10)
  return ref.id
}

function stepIdFromRef(ref: UiContextRef): string {
  return ref.moduleId ?? (ref.id.startsWith("step:") ? ref.id.slice(5) : ref.id)
}

/** AI : prefer server doc bytes / live project defs over client preview snippets. */
export function enrichUiContextRefs(
  store: Store,
  project: Project,
  refs: UiContextRef[] | undefined,
): UiContextRef[] {
  const items = dedupeUiContextRefs(refs ?? [])
  return items.map((ref) => {
    if (ref.kind === "project_doc") {
      const docId = docIdFromRef(ref)
      if (!docId) return ref
      const meta = store.docs().find((d) => d.id === docId)
      const content = store.docContent(docId)
      const snippet = truncateUiContextText(
        content ?? ref.snippet ?? meta?.preview ?? "",
        MAX_UI_CONTEXT_SNIPPET_CHARS,
      )
      return normalizeUiContextRef({
        ...ref,
        label: meta ? `File · ${meta.name}` : ref.label,
        snippet: snippet || undefined,
      })
    }

    if (ref.kind === "model" || (ref.kind === "generic" && (ref.id.startsWith("model:") || ref.id.startsWith("struct:")))) {
      const model = project.models.find((m) => m.id === modelIdFromRef(ref))
      if (!model) return ref
      const fieldNames = model.fields.map((f) => f.name).join(", ")
      const snippet = truncateUiContextText(
        [model.description, fieldNames ? `fields: ${fieldNames}` : ""]
          .filter(Boolean)
          .join("\n"),
        MAX_UI_CONTEXT_SNIPPET_CHARS,
      )
      return normalizeUiContextRef({
        ...ref,
        kind: "model",
        id: ref.id.startsWith("model:") ? ref.id : `model:${model.id}`,
        label: `Structure · ${model.name}`,
        snippet: snippet || ref.snippet,
      })
    }

    if (ref.kind === "type_alias" || (ref.kind === "generic" && (ref.id.startsWith("type:") || ref.id.startsWith("typealias:")))) {
      const alias = (project.typeAliases ?? []).find((t) => t.id === typeIdFromRef(ref))
      if (!alias) return ref
      return normalizeUiContextRef({
        ...ref,
        kind: "type_alias",
        id: ref.id.startsWith("type:") ? ref.id : `type:${alias.id}`,
        label: `Type · ${alias.name}`,
        snippet: truncateUiContextText(
          alias.description || ref.snippet || "",
          MAX_UI_CONTEXT_SNIPPET_CHARS,
        ) || undefined,
      })
    }

    if (ref.kind === "pipeline_step") {
      const step = project.modules.find((m) => m.id === stepIdFromRef(ref))
      if (!step) return ref
      const snippet = truncateUiContextText(
        [step.note, step.prompt].filter(Boolean).join("\n\n") || ref.snippet || "",
        MAX_UI_CONTEXT_SNIPPET_CHARS,
      )
      return normalizeUiContextRef({
        ...ref,
        moduleId: step.id,
        label: `${step.label} (${step.kind})`,
        snippet: snippet || undefined,
      })
    }

    return ref
  })
}
