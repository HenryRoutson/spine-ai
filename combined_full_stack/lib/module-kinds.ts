import { LegacyModuleKind, ModuleKind } from "@/lib/types"
import type { RunStepKind } from "@/lib/types"

// AI : kinds users can add in the builder / pipeline assistant (quote is auto-managed).
export const USER_ADDABLE_MODULE_KINDS = [
  ModuleKind.Input,
  ModuleKind.Llm,
  ModuleKind.LlmBatch,
  ModuleKind.ExampleSelect,
  ModuleKind.Transform,
  ModuleKind.Chunk,
  ModuleKind.Merge,
  ModuleKind.Combine,
  ModuleKind.CustomCode,
  ModuleKind.Assert,
  ModuleKind.HumanReview,
  ModuleKind.Output,
] as const satisfies readonly ModuleKind[]

// AI : output/assert/human-review use inStructureId as the spine passthrough contract.
export function usesPassthroughStructure(kind: ModuleKind): boolean {
  return kind === ModuleKind.Output || kind === ModuleKind.Assert || kind === ModuleKind.HumanReview
}

// AI : llm + llm-batch share prompt/model fields across UI and server validity.
export const LLM_KINDS: ModuleKind[] = [ModuleKind.Llm, ModuleKind.LlmBatch, ModuleKind.ExampleSelect]

export function isLlmKind(kind: RunStepKind): boolean {
  return LLM_KINDS.includes(kind as ModuleKind)
}

// AI : merge step + legacy list-merge kind string on run logs / migrated modules.
export function isMergeModuleKind(kind: string): boolean {
  return kind === ModuleKind.Merge || kind === LegacyModuleKind.ListMerge
}

// AI : input/combine/llm steps expose Annotation / purpose — must be non-empty when the pipeline is valid.
export function stepRequiresNote(kind: ModuleKind): boolean {
  return kind === ModuleKind.Input || kind === ModuleKind.Combine || isLlmKind(kind)
}

// AI : llm steps use prompt/response wording; quote step shows source + extracts → linked spans.
export function stepIoLabels(kind: RunStepKind) {
  if (kind === ModuleKind.Quote) {
    return { inTitle: "Source + extracts", outTitle: "Linked quotes" }
  }
  const isLlm = kind === ModuleKind.Llm || kind === ModuleKind.LlmBatch || kind === ModuleKind.ExampleSelect
  return {
    inTitle: isLlm ? "Prompt" : "Input",
    outTitle: isLlm ? "Response" : "Output",
  }
}
