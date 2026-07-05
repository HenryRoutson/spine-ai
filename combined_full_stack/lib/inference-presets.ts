// AI : named pre-selected runs — one resolver shared by inference presets AND *_testing.json tests,
// AI : so "input step label → doc name(s)" only resolves to run docs in one place.

import { validateInferenceDocAssignment } from "@/lib/inference-validity"
import { labelAsStateKey } from "@/lib/server/pipeline_state"
import { isMultiDocInputModule, orderedInputModules, type InputDocsAssignment } from "@/lib/inference-input-core"
import type { DocId, DocRef, InferencePreset, ModuleId, PipelineModule } from "@/lib/types"

export type { InferencePreset }

type step_label_string = string
type doc_name_string = string

export type NamedRunInputs = Record<step_label_string, doc_name_string | doc_name_string[]>

export type ResolvedNamedInputs =
  | {
      ok: true
      primary: DocId
      rest: DocId[]
      byModule: Partial<Record<ModuleId, DocId[]>>
      assignment: InputDocsAssignment
    }
  | { ok: false; error: string }

export function namedInputDocNames(value: doc_name_string | doc_name_string[]): doc_name_string[] {
  return (Array.isArray(value) ? value : [value]).filter((n) => n.trim())
}

export function flattenNamedInputs(inputs: NamedRunInputs): doc_name_string[] {
  return Object.values(inputs).flatMap(namedInputDocNames)
}

export function resolveNamedRunInputs(
  inputs: NamedRunInputs,
  modules: PipelineModule[],
  projectDocs: DocRef[],
): ResolvedNamedInputs {
  const byModule: Partial<Record<ModuleId, DocId[]>> = {}
  const assignment: InputDocsAssignment = {}
  const ordered: DocId[] = []
  for (const m of orderedInputModules(modules)) {
    const key = Object.keys(inputs).find((l) => labelAsStateKey(l) === labelAsStateKey(m.label))
    const names = key ? namedInputDocNames(inputs[key]!) : []
    if (!names.length) return { ok: false, error: `no input document set for step "${m.label}"` }
    const refs: DocRef[] = []
    for (const name of names) {
      const doc = projectDocs.find((d) => d.name === name)
      if (!doc) return { ok: false, error: `document "${name}" not found for step "${m.label}"` }
      const assignmentIssue = validateInferenceDocAssignment(m, doc)
      if (assignmentIssue) {
        return { ok: false, error: `${doc.name}: ${assignmentIssue.message} (step "${m.label}")` }
      }
      refs.push(doc)
    }
    byModule[m.id] = refs.map((d) => d.id as DocId)
    assignment[m.id] = isMultiDocInputModule(m) ? refs : refs[0]
    ordered.push(...refs.map((d) => d.id as DocId))
  }
  const [primary, ...rest] = ordered
  if (!primary) return { ok: false, error: "no input documents resolved" }
  return { ok: true, primary, rest, byModule, assignment }
}
