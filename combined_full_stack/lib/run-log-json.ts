// AI : full PipelineRun JSON for clipboard — includes llmCalls, failures, server logs, previews.
import { failuresFromLlmCalls } from "@/lib/llm-distribution"
import type { PipelineRun } from "@/lib/types"

export function runLogJson(run: PipelineRun): string {
  const enriched = {
    ...run,
    steps: run.steps.map((step) => {
      const llmFailures = failuresFromLlmCalls(step.llmCalls, step.status !== "error")
      const descFailures = failuresFromLlmCalls(
        step.descriptionCheckLlmCalls,
        step.inputDescriptionCheck?.matches !== false,
      )
      const mergedFailures = [...(step.failures ?? []), ...llmFailures, ...descFailures]
      return {
        ...step,
        failures: mergedFailures.length ? mergedFailures : step.failures,
      }
    }),
  }
  return JSON.stringify(enriched, null, 2)
}
