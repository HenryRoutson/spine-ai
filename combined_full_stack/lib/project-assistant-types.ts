import type { DocLabel, InputType, PipelineModule, StructureModel, TypeAlias } from "@/lib/types"

export const UNNAMED_PROJECT_NAME = "Untitled Pipeline" as const
export const BLANK_PROJECT_KIND = "blank" as const
export const AUTHORED_PROJECT_KIND = "custom" as const

export function isUnnamedProjectName(name: string): boolean {
  return name.trim() === UNNAMED_PROJECT_NAME
}

export type ProjectDocSpec = {
  name: string
  type: InputType
  content: string
  label: DocLabel
}

export type AssistantProposedAction =
  | { type: "run_inference" }
  | { type: "run_test"; testDocName?: string }

export type ProjectProposal = {
  modules: PipelineModule[]
  models: StructureModel[]
  typeAliases: TypeAlias[]
  docs: ProjectDocSpec[]
  documentation: string
  projectName?: string
  proposedActions?: AssistantProposedAction[]
  // AI : snapshot of live project at proposal time — review diffs stay correct after Approve.
  reviewFrom?: {
    models: StructureModel[]
    modules: PipelineModule[]
    typeAliases: TypeAlias[]
  }
  // AI : which parts changed — used to apply only deltas on approve
  changed: {
    // AI : TODO (arch-proposal-changed) — mirrors proposal fields; derive from a key list so we don't maintain two.
    modules: boolean
    models: boolean
    typeAliases: boolean
    docs: boolean
    documentation: boolean
    name?: boolean
    actions?: boolean
  }
}

export const PROJECT_ASSISTANT_INITIAL_MESSAGE =
  "Describe what you want to build. I'll propose structures, pipeline steps (with correct list/single spine wiring), docs, and sample test documents — same full project control whether you're on Vibe or Build. On Vibe, pick existing files and watch runs in Inference and Logging on the right. I can also propose a pipeline run after you approve. Approve to apply — invalid pipelines are caught and retried automatically before you see them."
