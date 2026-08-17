import { FieldType, ModuleKind, type PipelineModule, type StructureModel } from "@/lib/types"
import type { TypeExpr } from "@/lib/server/type_expr"

// AI : TODO (example-select-view) — {example} is per-candidate (uncached). Project the candidate for the
// AI :   prompt; keep the full list item on the spine. exampleContextField already projects {description};
// AI :   add the dual for {example} (examplePromptFields). {passthrough} is not a template var.
// AI : TODO (example-select-view) — billed_work Select Relevant Jobs: prompt only title + work_description;
// AI :   billed_items WI-xxxxx add uncached tokens and no pass-1 signal. Pass 2 {example} is a catalog row — leave it.
// AI : TODO (sql-schema) — that projection is CREATE VIEW job_example_prompt AS SELECT id, title, work_description FROM job_example;
// AI :   billed_line stays a table; join only in pass-2/draft views. DDL readable without a SQLite process.

export const DEFAULT_EXAMPLE_SELECT_PROMPT = `Find useful examples to help with this task.

DESCRIPTION:

{description}

POSSIBLE USEFUL EXAMPLE:

{example}`

export const DEFAULT_EXAMPLE_REASON_FIELD = "selection_reason"

export function isExampleSelectKind(kind: string): boolean {
  return kind === ModuleKind.ExampleSelect
}

export function exampleReasonField(m: PipelineModule): string {
  return m.exampleReasonField?.trim() || DEFAULT_EXAMPLE_REASON_FIELD
}

// AI : combine (and similar wrappers) may put the candidate list on a single field of a typed object.
export function exampleSelectItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === "object") {
    const arrays = Object.values(data as Record<string, unknown>).filter(Array.isArray)
    if (arrays.length === 1) return arrays[0] as unknown[]
  }
  return data == null ? [] : [data]
}

export function exampleSelectAcceptsWrapper(
  expected: TypeExpr,
  actual: TypeExpr,
  models: StructureModel[],
): boolean {
  if (expected.kind !== "list" || expected.item.kind !== "ref") return false
  if (actual.kind !== "ref") return false
  const model = models.find((x) => x.id === actual.modelId)
  if (!model) return false
  const matches = model.fields.filter(
    (f) => f.type === FieldType.ListModel && f.ref === expected.item.modelId,
  )
  return matches.length === 1
}
