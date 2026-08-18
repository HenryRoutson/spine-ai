// AI : TODO (tsx-export-star) — ModuleKind values are undefined under tsx ESM `export *` from
// AI :   lib/types.ts. isLlmKind("llm-batch") is then false, so computeLlmDocumentFieldInvalid
// AI :   never fires in MCP validate_project. Import from @/lib/server/types like mcp_tool does.
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
  ModuleKind.Assemble,
  ModuleKind.Parallel,
  ModuleKind.Combine,
  ModuleKind.CustomCode,
  ModuleKind.Assert,
  ModuleKind.HumanReview,
  ModuleKind.Webhook,
  // AI : TODO (n8n-stage-A-ui) — ModuleKind.N8n once kind exists (catalog picker, not generic webhook).
  ModuleKind.Chatbot,
  ModuleKind.Output,
] as const satisfies readonly ModuleKind[]

// AI : output/assert/human-review use inStructureId as the spine passthrough contract.
// AI : Chatbot is NOT passthrough — in=ChatbotPrompt, out=ChatbotResult.
export function usesPassthroughStructure(kind: ModuleKind): boolean {
  return kind === ModuleKind.Output || kind === ModuleKind.Assert || kind === ModuleKind.HumanReview
}

// AI : llm + llm-batch share prompt/model fields across UI and server validity.
export const LLM_KINDS: ModuleKind[] = [ModuleKind.Llm, ModuleKind.LlmBatch, ModuleKind.ExampleSelect]

export function isLlmKind(kind: RunStepKind): boolean {
  return LLM_KINDS.includes(kind as ModuleKind)
}

// AI : these kinds always put list[item] on the spine — structureOut is the ITEM name, not list[Name].
export function kindAlwaysEmitsList(kind: ModuleKind | string): boolean {
  return kind === ModuleKind.LlmBatch || kind === ModuleKind.ExampleSelect || kind === ModuleKind.Chunk
}

// AI : merge step + legacy list-merge kind string on run logs / migrated modules.
export function isMergeModuleKind(kind: string): boolean {
  return kind === ModuleKind.Merge || kind === LegacyModuleKind.ListMerge
}

// AI : input/combine/llm steps expose Annotation / purpose — must be non-empty when the pipeline is valid.
export function stepRequiresNote(kind: ModuleKind): boolean {
  return (
    kind === ModuleKind.Input ||
    kind === ModuleKind.Combine ||
    kind === ModuleKind.Assemble ||
    kind === ModuleKind.Parallel ||
    isLlmKind(kind)
  )
}

// AI : llm steps use prompt/response wording; quote step shows source + extracts → linked spans.
export function stepIoLabels(kind: RunStepKind) {
  if (kind === ModuleKind.Quote) {
    return { inTitle: "Source + extracts", outTitle: "Linked quotes" }
  }
  if (kind === ModuleKind.Chatbot) {
    return { inTitle: "Prompt (ChatbotPrompt)", outTitle: "Chat result" }
  }
  const isLlm = kind === ModuleKind.Llm || kind === ModuleKind.LlmBatch || kind === ModuleKind.ExampleSelect
  return {
    inTitle: isLlm ? "Prompt" : "Input",
    outTitle: isLlm ? "Response" : "Output",
  }
}
