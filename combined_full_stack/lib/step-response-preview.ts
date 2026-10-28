import type { ExampleSelectVerdict } from "@/lib/example-select-verdicts"
import type { InputPreviewItem } from "@/lib/server/types"

export function jsonPreviewText(value: unknown): string {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  return JSON.stringify(value, null, 2)
}

export function labeledJsonPreviewItems(
  rows: unknown[],
  labels?: { label: string }[],
  noun = "item",
): InputPreviewItem[] {
  return rows.map((row, i) => ({
    label: labels?.[i]?.label ?? `${noun} ${i + 1}/${rows.length}`,
    text: jsonPreviewText(row ?? {}),
  }))
}

type StepResponsePreviewSource = {
  outputJson?: string
  outputPreviewItems?: InputPreviewItem[]
  exampleSelectVerdicts?: ExampleSelectVerdict[]
  inputPreviewItems?: InputPreviewItem[]
}

// AI : per-call LLM JSON — example-select keeps rejected rows; outputJson is the filtered list.
export function resolveStepResponsePreviewItems(step: StepResponsePreviewSource): InputPreviewItem[] {
  if (step.outputPreviewItems?.length) return step.outputPreviewItems

  if (step.exampleSelectVerdicts?.length) {
    const total = step.exampleSelectVerdicts.length
    return step.exampleSelectVerdicts.map((verdict, i) => ({
      label: step.inputPreviewItems?.[i]?.label ?? `candidate ${i + 1}/${total}`,
      text: jsonPreviewText({
        is_relevant: verdict.is_relevant,
        chain_of_thought: verdict.chain_of_thought,
      }),
    }))
  }

  if (!step.outputJson?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(step.outputJson)
    const prompts = step.inputPreviewItems
    if (Array.isArray(parsed) && prompts?.length && parsed.length === prompts.length) {
      return labeledJsonPreviewItems(parsed, prompts)
    }
    return [{ label: "response", text: jsonPreviewText(parsed) }]
  } catch {
    return [{ label: "response", text: step.outputJson }]
  }
}
