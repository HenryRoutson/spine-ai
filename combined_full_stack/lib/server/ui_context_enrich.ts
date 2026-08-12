// AI : fill @ / Select UI pins with store-backed content before the LLM prompt (never trust client snippets alone).

import {
  formatExampleSelectDesignTimeCacheSnippet,
  formatRunErrorPinSnippet,
  formatRunStepPromptCacheSnippet,
  runIdFromUiContextId,
} from "@/lib/assistant-observe"
import { runHasErrors } from "@/lib/run-error-log"
import {
  dedupeUiContextRefs,
  normalizeUiContextRef,
  truncateUiContextText,
  MAX_UI_CONTEXT_SNIPPET_CHARS,
  type UiContextRef,
} from "@/lib/ui-context-types"
import { ModuleKind, type DocId, type Project, type ProjectId } from "./types"
import type { Store } from "./store"

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

function findProjectRun(store: Store, projectId: ProjectId, runId: string) {
  return store.runs(projectId).find((r) => r.id === runId)
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

    // AI : full server run (not slim client list) — includes serverLogs for error pins.
    if (
      ref.kind === "run_error" ||
      (ref.kind === "generic" && (ref.id.startsWith("run:") || ref.id.startsWith("run-error:")))
    ) {
      const runId = runIdFromUiContextId(ref.id)
      if (!runId) return ref
      const run = findProjectRun(store, project.id, runId)
      if (!run) return ref
      const snippet = formatRunErrorPinSnippet(run)
      return normalizeUiContextRef({
        ...ref,
        kind: runHasErrors(run) ? "run_error" : "generic",
        id: `run:${run.id}`,
        label: `Run · ${run.status} · ${run.id.slice(0, 8)}`,
        snippet: snippet || ref.snippet,
      })
    }

    if (ref.kind === "prompt_cache") {
      const moduleId = stepIdFromRef(ref)
      const step = project.modules.find((m) => m.id === moduleId)
      if (step?.kind === ModuleKind.ExampleSelect && step.prompt?.trim()) {
        return normalizeUiContextRef({
          ...ref,
          moduleId: step.id,
          id: ref.id.startsWith("cache:") ? ref.id : `cache:${step.id}`,
          label: `Cache · ${step.label}`,
          snippet: formatExampleSelectDesignTimeCacheSnippet(step.label, step.prompt),
        })
      }
      // AI : runtime — id cache:run:${runId}:step:${moduleId} or fieldPath runId.
      const runId =
        ref.fieldPath?.startsWith("run:")
          ? ref.fieldPath.slice(4)
          : ref.id.startsWith("cache:run:")
            ? ref.id.slice("cache:run:".length).split(":step:")[0]
            : null
      const runStepId =
        ref.moduleId ??
        (ref.id.includes(":step:") ? ref.id.split(":step:")[1] : null)
      if (runId && runStepId) {
        const run = findProjectRun(store, project.id, runId)
        const runStep = run?.steps.find((s) => s.moduleId === runStepId)
        if (runStep) {
          return normalizeUiContextRef({
            ...ref,
            moduleId: runStep.moduleId,
            label: `Cache · ${runStep.label}`,
            snippet: formatRunStepPromptCacheSnippet(runStep),
          })
        }
      }
      if (step?.prompt?.trim()) {
        return normalizeUiContextRef({
          ...ref,
          moduleId: step.id,
          label: `Cache · ${step.label}`,
          snippet: truncateUiContextText(
            `Prompt template (no multi-candidate cache yet):\n${step.prompt}`,
            MAX_UI_CONTEXT_SNIPPET_CHARS,
          ),
        })
      }
      return ref
    }

    return ref
  })
}
