import type { ModuleId, PipelineRun, RunStep, RunStepStatus } from "@/lib/types"
import { distributionStats } from "@/lib/llm-distribution"

export type StepSampleStatus = "ok" | "error"

export type StepSample = {
  ms: number
  costCents: number
  descriptionCheckCostCents: number
  status: StepSampleStatus
}

export type StepProfile = {
  moduleId: ModuleId
  label: string
  samples: StepSample[]
}

export type StepMeanStats = {
  moduleId: ModuleId
  label: string
  meanMs: number
  meanCostCents: number
  meanDescriptionCheckCostCents: number
  failed: number
  n: number
}

// AI : cached counts as pass — only hard failures are red on the bars.
export function stepSampleStatus(status: RunStepStatus): StepSampleStatus {
  return status === "error" ? "error" : "ok"
}

export function runStepSignature(steps: RunStep[]): string {
  return steps.map((s) => s.moduleId).join("|")
}

export function runsMatchingSignature(runs: PipelineRun[], signature: string): PipelineRun[] {
  return runs.filter((r) => runStepSignature(r.steps) === signature)
}

export function buildStepProfiles(runs: PipelineRun[], stepOrder: RunStep[]): StepProfile[] {
  return stepOrder.map((ref) => {
    const samples: StepSample[] = []
    for (const run of runs) {
      const step = run.steps.find((s) => s.moduleId === ref.moduleId)
      if (!step) continue
      if (step.status === "skipped") continue
      samples.push({
        ms: step.ms,
        costCents: step.costCents,
        descriptionCheckCostCents: step.descriptionCheckCostCents ?? 0,
        status: stepSampleStatus(step.status),
      })
    }
    return { moduleId: ref.moduleId, label: ref.label, samples }
  })
}

export function buildStepMeanStats(profiles: StepProfile[]): StepMeanStats[] {
  return profiles
    .filter((p) => p.samples.length > 0)
    .map((p) => {
      const ms = p.samples.map((s) => s.ms)
      const cost = p.samples.map((s) => s.costCents)
      const descCost = p.samples.map((s) => s.descriptionCheckCostCents)
      return {
        moduleId: p.moduleId,
        label: p.label,
        meanMs: distributionStats(ms).mean,
        meanCostCents: distributionStats(cost).mean,
        meanDescriptionCheckCostCents: distributionStats(descCost).mean,
        failed: p.samples.filter((s) => s.status === "error").length,
        n: p.samples.length,
      }
    })
}
