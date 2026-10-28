import type { ExampleSelectRelevanceResult } from "@/lib/example-select-relevance"

// AI : per-candidate audit row — kept and rejected items share the same shape for traceability.
export type ExampleSelectVerdict = {
  promptIndex: number
  is_relevant: boolean
  chain_of_thought: string
  candidateLabel: string
  candidate: unknown
}

export function exampleSelectCandidateLabel(item: unknown): string {
  if (item != null && typeof item === "object" && !Array.isArray(item)) {
    const rec = item as Record<string, unknown>
    for (const key of ["id", "code", "title", "name"]) {
      const v = rec[key]
      if (typeof v === "string" && v.trim()) return v.trim()
    }
  }
  return "candidate"
}

export function buildExampleSelectVerdicts(
  items: unknown[],
  relevanceRows: (ExampleSelectRelevanceResult | undefined)[],
  reasonField: string,
): { kept: Record<string, unknown>[]; verdicts: ExampleSelectVerdict[] } {
  const kept: Record<string, unknown>[] = []
  const verdicts: ExampleSelectVerdict[] = []

  for (let i = 0; i < items.length; i++) {
    const verdict = relevanceRows[i]
    const chainOfThought = verdict?.chain_of_thought?.trim() ?? ""
    const isRelevant = verdict?.is_relevant === true
    verdicts.push({
      promptIndex: i,
      is_relevant: isRelevant,
      chain_of_thought: chainOfThought,
      candidateLabel: exampleSelectCandidateLabel(items[i]),
      candidate: items[i],
    })
    if (!isRelevant) continue
    if (items[i] != null && typeof items[i] === "object" && !Array.isArray(items[i])) {
      // AI : TODO (example-select-view) — this spread is the passthrough: full candidate, not the prompt view.
      kept.push({ ...(items[i] as Record<string, unknown>), [reasonField]: chainOfThought })
    } else {
      kept.push({ value: items[i], [reasonField]: chainOfThought })
    }
  }

  return { kept, verdicts }
}
