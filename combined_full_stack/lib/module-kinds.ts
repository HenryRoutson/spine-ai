import type { ModuleKind } from "@/lib/types"

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
