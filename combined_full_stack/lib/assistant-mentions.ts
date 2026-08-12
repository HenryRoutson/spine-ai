// AI : @-mention catalog for the agent composer — keyboard pins into the same UiContextRef chips as Select UI.

import {
  modulesWithPromptCache,
  runMentionLabel,
} from "@/lib/assistant-observe"
import { docLabelDisplay } from "@/lib/project-docs"
import { runHasErrors } from "@/lib/run-error-log"
import type { DocRef, PipelineModule, PipelineRun, StructureModel, TypeAlias } from "@/lib/types"
import { MODULE_META, ModuleKind } from "@/lib/types"
import {
  type UiContextKind,
  type UiContextRef,
  normalizeUiContextRef,
} from "@/lib/ui-context-types"

export type AssistantMentionGroup =
  | "Steps"
  | "Models"
  | "Types"
  | "Files"
  | "Issues"
  | "Runs"
  | "Cache"
  | "Actions"

export type AssistantMentionAction = "select_ui"

export type AssistantMentionOption = {
  id: string
  group: AssistantMentionGroup
  label: string
  description?: string
  /** AI : pinable context; null for actions like Select UI. */
  ref: UiContextRef | null
  action?: AssistantMentionAction
}

export type AssistantMentionIssue = {
  id: string
  label: string
  message: string
  moduleId?: string
}

export type AtTrigger = {
  /** Index of `@` in the textarea value. */
  start: number
  /** Caret index (end of query). */
  end: number
  query: string
}

// AI : @ starts a mention when at start-of-text or after whitespace; query ends at caret (no spaces).
export function findAtTrigger(value: string, caret: number): AtTrigger | null {
  if (caret < 0 || caret > value.length) return null
  const before = value.slice(0, caret)
  const match = /(?:^|[\s\n])@([^\s@]*)$/.exec(before)
  if (!match) return null
  const query = match[1] ?? ""
  const start = before.length - query.length - 1
  if (start < 0 || value[start] !== "@") return null
  return { start, end: caret, query }
}

export function stripAtTrigger(value: string, trigger: AtTrigger): string {
  return `${value.slice(0, trigger.start)}${value.slice(trigger.end)}`
}

function matchesQuery(option: AssistantMentionOption, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = `${option.label} ${option.description ?? ""} ${option.group}`.toLowerCase()
  return hay.includes(q)
}

export function filterMentionOptions(
  options: AssistantMentionOption[],
  query: string,
): AssistantMentionOption[] {
  return options.filter((o) => matchesQuery(o, query))
}

export function groupMentionOptions(
  options: AssistantMentionOption[],
): { group: AssistantMentionGroup; items: AssistantMentionOption[] }[] {
  const order: AssistantMentionGroup[] = [
    "Actions",
    "Issues",
    "Runs",
    "Cache",
    "Steps",
    "Models",
    "Types",
    "Files",
  ]
  const byGroup = new Map<AssistantMentionGroup, AssistantMentionOption[]>()
  for (const o of options) {
    const list = byGroup.get(o.group) ?? []
    list.push(o)
    byGroup.set(o.group, list)
  }
  return order
    .map((group) => ({ group, items: byGroup.get(group) ?? [] }))
    .filter((g) => g.items.length > 0)
}

function pin(
  kind: UiContextKind,
  id: string,
  label: string,
  extra?: Partial<Pick<UiContextRef, "moduleId" | "fieldPath" | "snippet">>,
): UiContextRef {
  return normalizeUiContextRef({ id, kind, label, ...extra })
}

const MAX_RUN_MENTIONS = 12

/** AI : build @-menu rows from the open project (store). */
export function buildAssistantMentionOptions(args: {
  modules: PipelineModule[]
  models: StructureModel[]
  typeAliases: TypeAlias[]
  docs: DocRef[]
  issues?: AssistantMentionIssue[]
  runs?: PipelineRun[]
  includeSelectUiAction?: boolean
}): AssistantMentionOption[] {
  const out: AssistantMentionOption[] = []

  if (args.includeSelectUiAction !== false) {
    out.push({
      id: "action:select_ui",
      group: "Actions",
      label: "Select UI…",
      description: "Crosshair — click a step, field, or error",
      ref: null,
      action: "select_ui",
    })
  }

  for (const issue of args.issues ?? []) {
    out.push({
      id: issue.id,
      group: "Issues",
      label: issue.label,
      description: issue.message,
      ref: pin("invalid_issue", issue.id, issue.label, {
        moduleId: issue.moduleId,
        snippet: issue.message,
      }),
    })
  }

  const runs = (args.runs ?? [])
    .slice()
    .sort((a, b) => {
      const ae = runHasErrors(a) ? 0 : 1
      const be = runHasErrors(b) ? 0 : 1
      if (ae !== be) return ae - be
      return b.startedAt - a.startedAt
    })
    .slice(0, MAX_RUN_MENTIONS)
  for (const run of runs) {
    const failed = runHasErrors(run)
    out.push({
      id: `run:${run.id}`,
      group: "Runs",
      label: failed ? `Error · ${run.id.slice(0, 8)}` : `Ok · ${run.id.slice(0, 8)}`,
      description: runMentionLabel(run),
      ref: pin(failed ? "run_error" : "generic", `run:${run.id}`, `Run · ${run.status}`, {
        snippet: runMentionLabel(run),
      }),
    })
  }

  for (const m of modulesWithPromptCache(args.modules)) {
    const kindLabel = MODULE_META[m.kind]?.label ?? m.kind
    out.push({
      id: `cache:${m.id}`,
      group: "Cache",
      label: m.label || kindLabel,
      description:
        m.kind === ModuleKind.ExampleSelect
          ? "Design-time cached prefix preview"
          : "Prompt / cache preview",
      ref: pin("prompt_cache", `cache:${m.id}`, `Cache · ${m.label || kindLabel}`, {
        moduleId: m.id,
        snippet: m.prompt?.slice(0, 400) || undefined,
      }),
    })
  }

  for (const m of args.modules) {
    const kindLabel = MODULE_META[m.kind]?.label ?? m.kind
    out.push({
      id: `step:${m.id}`,
      group: "Steps",
      label: m.label || kindLabel,
      description: `${kindLabel}${m.note ? ` · ${m.note}` : ""}`,
      ref: pin("pipeline_step", `step:${m.id}`, `${m.label || kindLabel} (${m.kind})`, {
        moduleId: m.id,
        snippet: m.note || m.prompt?.slice(0, 400) || undefined,
      }),
    })
  }

  for (const model of args.models) {
    out.push({
      id: `model:${model.id}`,
      group: "Models",
      label: model.name,
      description: model.description || `${model.fields.length} fields`,
      ref: pin("model", `model:${model.id}`, `Structure · ${model.name}`, {
        snippet: model.description || `${model.fields.length} fields`,
      }),
    })
  }

  for (const t of args.typeAliases) {
    out.push({
      id: `type:${t.id}`,
      group: "Types",
      label: t.name,
      description: t.description || undefined,
      ref: pin("type_alias", `type:${t.id}`, `Type · ${t.name}`, {
        snippet: t.description || undefined,
      }),
    })
  }

  for (const doc of args.docs) {
    const label = docLabelDisplay(doc.label)
    out.push({
      id: `doc:${doc.id}`,
      group: "Files",
      label: doc.name,
      description: `${label} · ${doc.type} · ${doc.sizeKb}KB`,
      // AI : client preview only — server enrichUiContextRefs replaces with doc bytes.
      ref: pin("project_doc", `doc:${doc.id}`, `File · ${doc.name}`, {
        snippet: doc.preview || undefined,
      }),
    })
  }

  return out
}

// AI : TODO (assistant-@-mention) — permanent file tags/notes that auto-attach every turn (see TODO.txt).
// AI : TODO (assistant-@-mention) — caret-anchored popover + TipTap inline @ tokens (chat.tsx).
