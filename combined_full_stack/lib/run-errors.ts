import type { PipelineRun } from "@/lib/types"

// AI : step errors live on RunStep.outputPreview — surface them instead of a generic "run error".
export function pipelineRunError(run: PipelineRun): string | null {
  const step = run.steps.find((s) => s.status === "error")
  if (!step) return run.status === "error" ? "Pipeline failed" : null
  return step.outputPreview ? `${step.label}: ${step.outputPreview}` : `${step.label} failed`
}
