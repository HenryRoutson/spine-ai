import type { ModuleKind } from "@/lib/types"

// AI : kinds users can add in the builder / pipeline assistant (quote is auto-managed).
export const USER_ADDABLE_MODULE_KINDS = [
  "input",
  "doc-to-text",
  "llm",
  "llm-batch",
  "transform",
  "combine",
  "custom-code",
  "assert",
  "output",
] as const satisfies readonly ModuleKind[]

// AI : llm + llm-batch share prompt/model fields across UI and server validity.
export const LLM_KINDS: ModuleKind[] = ["llm", "llm-batch"]

export function isLlmKind(kind: ModuleKind): boolean {
  return LLM_KINDS.includes(kind)
}

// AI : llm steps use prompt/response wording; quote step shows source + extracts → linked spans.
export function stepIoLabels(kind: ModuleKind) {
  if (kind === "quote") {
    return { inTitle: "Source + extracts", outTitle: "Linked quotes" }
  }
  const isLlm = isLlmKind(kind)
  return {
    inTitle: isLlm ? "Prompt" : "Input",
    outTitle: isLlm ? "Response" : "Output",
  }
}
