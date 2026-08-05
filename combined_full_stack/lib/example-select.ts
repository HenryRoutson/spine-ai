import { ModuleKind, type PipelineModule } from "@/lib/types"

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
