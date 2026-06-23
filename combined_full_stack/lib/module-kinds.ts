import type { ModuleKind } from "@/lib/types"

// AI : llm + llm-batch share prompt/model fields across UI and server validity.
export const LLM_KINDS: ModuleKind[] = ["llm", "llm-batch"]

export function isLlmKind(kind: ModuleKind): boolean {
  return LLM_KINDS.includes(kind)
}
