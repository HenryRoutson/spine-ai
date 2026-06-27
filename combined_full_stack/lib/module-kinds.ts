import type { ModuleKind, RunStepKind } from "@/lib/types"

// AI : kinds users can add in the builder / pipeline assistant (quote is auto-managed).
export const USER_ADDABLE_MODULE_KINDS = [
  "input",
  "llm",
  "llm-batch",
  "transform",
  "combine",
  "custom-code",
  "assert",
  "human-review",
  "output",
] as const satisfies readonly ModuleKind[]

// AI : output/assert/human-review use inStructureId as the spine passthrough contract.
export function usesPassthroughStructure(kind: ModuleKind): boolean {
  return kind === "output" || kind === "assert" || kind === "human-review"
}

// AI : llm + llm-batch share prompt/model fields across UI and server validity.
export const LLM_KINDS: ModuleKind[] = ["llm", "llm-batch"]

export function isLlmKind(kind: ModuleKind): boolean {
  return LLM_KINDS.includes(kind)
}

// AI : llm steps use prompt/response wording; quote step shows source + extracts → linked spans.
export function stepIoLabels(kind: RunStepKind) {
  if (kind === "quote") {
    return { inTitle: "Source + extracts", outTitle: "Linked quotes" }
  }
  const isLlm = kind === "llm" || kind === "llm-batch"
  return {
    inTitle: isLlm ? "Prompt" : "Input",
    outTitle: isLlm ? "Response" : "Output",
  }
}
