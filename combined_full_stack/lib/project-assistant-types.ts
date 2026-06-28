import type { DocLabel, InputType, PipelineModule, StructureModel } from "@/lib/types"

export type ProjectDocSpec = {
  name: string
  type: InputType
  content: string
  label: DocLabel
}

export type ProjectProposal = {
  modules: PipelineModule[]
  models: StructureModel[]
  docs: ProjectDocSpec[]
  // AI : which parts changed — used to apply only deltas on approve
  changed: {
    modules: boolean
    models: boolean
    docs: boolean
  }
}

export const PROJECT_ASSISTANT_INITIAL_MESSAGE =
  "Describe what you want to build — I can propose structure models, pipeline steps, and inference test documents in one shot. Approve to apply everything."

export const PROJECT_ASSISTANT_STARTERS = [
  "Set up structures, pipeline, and sample test documents from scratch",
  "Design a map-reduce pipeline for long document field extraction",
  "Create inference test documents that match my input steps",
  "Fix validation errors and simplify this project",
]
