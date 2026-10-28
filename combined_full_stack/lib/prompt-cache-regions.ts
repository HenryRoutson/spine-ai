import type { InputPreviewItem } from "@/lib/server/types"
import { ModuleKind, type RunStepKind } from "@/lib/server/types"

const PROMPT_PREVIEW_KINDS = new Set<RunStepKind>([
  ModuleKind.Llm,
  ModuleKind.LlmBatch,
  ModuleKind.ExampleSelect,
])

export type PromptCacheRegions = {
  prefixLen: number
  candidateCount: number
  prefixChars: number
  suffixCharsMin: number
  suffixCharsMax: number
  sharedRatio: number
}

export function longestCommonPrefixLength(texts: readonly string[]): number {
  if (texts.length <= 1) return texts[0]?.length ?? 0
  let prefix = texts[0] ?? ""
  for (let i = 1; i < texts.length; i++) {
    const next = texts[i] ?? ""
    let j = 0
    const limit = Math.min(prefix.length, next.length)
    while (j < limit && prefix[j] === next[j]) j++
    prefix = prefix.slice(0, j)
    if (!prefix.length) break
  }
  return prefix.length
}

export function analyzePromptCacheRegions(prompts: readonly string[]): PromptCacheRegions | null {
  const texts = prompts.filter((t) => t.length > 0)
  if (texts.length <= 1) return null

  const prefixLen = longestCommonPrefixLength(texts)
  const suffixLengths = texts.map((t) => t.length - prefixLen)
  const avgLen = texts.reduce((sum, t) => sum + t.length, 0) / texts.length

  return {
    prefixLen,
    candidateCount: texts.length,
    prefixChars: prefixLen,
    suffixCharsMin: Math.min(...suffixLengths),
    suffixCharsMax: Math.max(...suffixLengths),
    sharedRatio: avgLen > 0 ? prefixLen / avgLen : 0,
  }
}

export function promptTextsFromItems(
  inputPreview?: string,
  inputPreviewItems?: InputPreviewItem[],
): string[] {
  if (inputPreviewItems?.length) return inputPreviewItems.map((item) => item.text)
  if (inputPreview?.trim()) return [inputPreview]
  return []
}

export function resolvePromptPreviewItems(
  inputPreview?: string,
  inputPreviewItems?: InputPreviewItem[],
): InputPreviewItem[] {
  if (inputPreviewItems?.length) return inputPreviewItems
  if (inputPreview?.trim()) return [{ label: "prompt", text: inputPreview }]
  return []
}

export function stepHasPromptPreview(step: {
  kind: RunStepKind
  inputPreview?: string
  inputPreviewItems?: InputPreviewItem[]
}): boolean {
  if (!PROMPT_PREVIEW_KINDS.has(step.kind)) return false
  return promptTextsFromItems(step.inputPreview, step.inputPreviewItems).length > 0
}

export function formatPromptCacheRatio(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}
