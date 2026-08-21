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
  uiContextIdBase,
  MAX_UI_CONTEXT_SNIPPET_CHARS,
  type UiContextRef,
} from "@/lib/ui-context-types"
import { ModuleKind, type DocId, type Project, type ProjectId } from "./types"
import type { Store } from "./store"

function docIdFromRef(ref: UiContextRef): DocId | null {
  const base = uiContextIdBase(ref.id)
  const raw = base.startsWith("doc:") ? base.slice(4) : base
  if (!raw.trim()) return null
  return raw as DocId
}

function modelIdFromRef(ref: UiContextRef): string {
  const base = uiContextIdBase(ref.id)
  if (base.startsWith("model:")) return base.slice(6)
  // AI : legacy Select UI ids before model: prefix.
  if (base.startsWith("struct:")) return base.slice(7)
  return base
}

function typeIdFromRef(ref: UiContextRef): string {
  const base = uiContextIdBase(ref.id)
  if (base.startsWith("type:")) return base.slice(5)
  if (base.startsWith("typealias:")) return base.slice(10)
  return base
}

function stepIdFromRef(ref: UiContextRef): string {
  if (ref.moduleId) return ref.moduleId
  const base = uiContextIdBase(ref.id)
  return base.startsWith("step:") ? base.slice(5) : base
}

function findProjectRun(store: Store, projectId: ProjectId, runId: string) {
  return store.runs(projectId).find((r) => r.id === runId)
}

function mergePickSnippet(pick: string | undefined, live: string | undefined): string | undefined {
  const a = pick?.trim()
  const b = live?.trim()
  if (a && b && a !== b && !a.includes(b)) {
    return truncateUiContextText(`${a}\n\n--- live ---\n${b}`, MAX_UI_CONTEXT_SNIPPET_CHARS)
  }
  return truncateUiContextText(a || b || "", MAX_UI_CONTEXT_SNIPPET_CHARS) || undefined
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
      const live = content ?? ref.snippet ?? meta?.preview ?? ""
      return normalizeUiContextRef({
        ...ref,
        label: meta ? (ref.id.includes("#") ? ref.label : `File · ${meta.name}`) : ref.label,
        snippet: mergePickSnippet(ref.snippet, live),
      })
    }

    const idBase = uiContextIdBase(ref.id)
    const isLeafPick = ref.id.includes("#") || !!ref.fieldPath

    if (ref.kind === "model" || (ref.kind === "generic" && (idBase.startsWith("model:") || idBase.startsWith("struct:")))) {
      const model = project.models.find((m) => m.id === modelIdFromRef(ref))
      if (!model) return ref
      const fieldNames = model.fields.map((f) => f.name).join(", ")
      const live = truncateUiContextText(
        [model.description, fieldNames ? `fields: ${fieldNames}` : ""]
          .filter(Boolean)
          .join("\n"),
        MAX_UI_CONTEXT_SNIPPET_CHARS,
      )
      return normalizeUiContextRef({
        ...ref,
        kind: "model",
        id: isLeafPick ? ref.id : idBase.startsWith("model:") ? idBase : `model:${model.id}`,
        label: isLeafPick ? ref.label : `Structure · ${model.name}`,
        snippet: mergePickSnippet(ref.snippet, live),
      })
    }

    if (ref.kind === "type_alias" || (ref.kind === "generic" && (idBase.startsWith("type:") || idBase.startsWith("typealias:")))) {
      const alias = (project.typeAliases ?? []).find((t) => t.id === typeIdFromRef(ref))
      if (!alias) return ref
      return normalizeUiContextRef({
        ...ref,
        kind: "type_alias",
        id: isLeafPick ? ref.id : idBase.startsWith("type:") ? idBase : `type:${alias.id}`,
        label: isLeafPick ? ref.label : `Type · ${alias.name}`,
        snippet: mergePickSnippet(ref.snippet, alias.description),
      })
    }

    if (ref.kind === "pipeline_step") {
      const step = project.modules.find((m) => m.id === stepIdFromRef(ref))
      if (!step) return ref
      const live = [step.note, step.prompt].filter(Boolean).join("\n\n")
      return normalizeUiContextRef({
        ...ref,
        moduleId: step.id,
        label: isLeafPick ? ref.label : `${step.label} (${step.kind})`,
        snippet: mergePickSnippet(ref.snippet, live) || undefined,
      })
    }

    // AI : full server run (not slim client list) — includes serverLogs for error pins.
    if (
      ref.kind === "run_error" ||
      (ref.kind === "generic" && (idBase.startsWith("run:") || idBase.startsWith("run-error:")))
    ) {
      const runId = runIdFromUiContextId(ref.id)
      if (!runId) return ref
      const run = findProjectRun(store, project.id, runId)
      if (!run) return ref
      const live = formatRunErrorPinSnippet(run)
      return normalizeUiContextRef({
        ...ref,
        kind: runHasErrors(run) ? "run_error" : "generic",
        id: isLeafPick ? ref.id : `run:${run.id}`,
        label: isLeafPick ? ref.label : `Run · ${run.status} · ${run.id.slice(0, 8)}`,
        snippet: mergePickSnippet(ref.snippet, live),
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
