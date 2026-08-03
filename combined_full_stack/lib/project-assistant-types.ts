import type { DocLabel, InputType, PipelineModule, StructureModel, TypeAlias } from "@/lib/types"

export const UNNAMED_PROJECT_NAME = "Untitled Pipeline" as const

export function isUnnamedProjectName(name: string): boolean {
  return name.trim() === UNNAMED_PROJECT_NAME
}

export type ProjectDocSpec = {
  name: string
  type: InputType
  content: string
  label: DocLabel
}

export type ProjectProposal = {
  modules: PipelineModule[]
  models: StructureModel[]
  typeAliases: TypeAlias[]
  docs: ProjectDocSpec[]
  documentation: string
  projectName?: string
  // AI : which parts changed — used to apply only deltas on approve
  changed: { // TODO should be reccusive? remove duplication
    modules: boolean
    models: boolean
    typeAliases: boolean
    docs: boolean
    documentation: boolean
    name?: boolean
  }
}

export const PROJECT_ASSISTANT_INITIAL_MESSAGE =
  "Describe what you want to build. I'll propose structures, pipeline steps (with correct list/single spine wiring), and sample test documents. Approve to apply — invalid pipelines are caught and retried automatically before you see them."

export const PROJECT_ASSISTANT_STARTERS = [
  "Set up structures, type aliases, pipeline, and sample test documents from scratch",
  "Add reusable types like list[quote_id_t] and wire them into my structs",
  "Design a map-reduce pipeline for long document field extraction",
  "Create inference test documents that match my input steps",
  "Fix validation errors and simplify this project",
]
