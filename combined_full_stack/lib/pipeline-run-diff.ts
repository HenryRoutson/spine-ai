import { LegacyModuleKind, ModuleKind } from "@/lib/types"
import type { PipelineModule, RunStep } from "@/lib/types"

function moduleKindFromRunStep(kind: RunStep["kind"]): ModuleKind {
  if (kind === LegacyModuleKind.DocToText) return ModuleKind.Input
  if (kind === LegacyModuleKind.ListMerge) return ModuleKind.Merge
  return kind
}

// AI : rebuild the pipeline shape a run executed against — step order + labels/kinds at run time.
export function modulesFromRunSteps(steps: RunStep[]): PipelineModule[] {
  return steps.map((step) => ({
    id: step.moduleId,
    kind: moduleKindFromRunStep(step.kind),
    label: step.label,
    note: step.label,
    cached: true,
    avgMs: step.ms,
    avgCostCents: step.costCents,
    model: step.model,
  }))
}

// AI : enrich run-time modules with current I/O config when the step id still exists.
export function enrichRunModules(runModules: PipelineModule[], current: PipelineModule[]): PipelineModule[] {
  return runModules.map((rm) => {
    const cm = current.find((m) => m.id === rm.id)
    if (!cm) return rm
    return {
      ...cm,
      label: rm.label,
      kind: rm.kind,
      model: rm.model ?? cm.model,
    }
  })
}
