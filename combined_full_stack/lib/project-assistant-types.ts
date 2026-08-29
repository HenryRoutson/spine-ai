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
  // AI : named pipeline to write modules onto — a new name adds a function and leaves the others alone.
  targetFunctionName?: string
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
    function?: boolean
  }
}

// AI : one question for Vibe and Build — stored welcome is shared across surfaces.
export const PROJECT_ASSISTANT_INITIAL_MESSAGE = "What do you want to build?"

export function isCannedProjectAssistantWelcome(content: string, id?: string): boolean {
  if (id?.endsWith("-welcome")) return true
  const text = content.trim()
  if (text === PROJECT_ASSISTANT_INITIAL_MESSAGE) return true
  return text.startsWith("Describe what you want to build.")
}
