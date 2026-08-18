import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { segmentPipeline, type PipelineSegment } from "@/lib/pipeline-layout"
import type { StepUiState } from "@/lib/run-engine"
import type { ModuleId, PipelineModule } from "@/lib/types"

export function progressPctFromStepStates(
  modules: PipelineModule[],
  stepStates: Map<ModuleId, StepUiState>,
): number {
  const flat = flattenPipelineModules(modules)
  const done = flat.filter((m) => {
    const s = stepStates.get(m.id)?.status
    return s !== undefined && s !== "idle" && s !== "running"
  }).length
  return Math.round((done / Math.max(1, flat.length)) * 100)
}

export function activeStepLabelFromStepStates(
  modules: PipelineModule[],
  stepStates: Map<ModuleId, StepUiState>,
): string | null {
  return firstRunningLabel(segmentPipeline(modules), stepStates)
}

function firstRunningLabel(
  segments: PipelineSegment[],
  stepStates: Map<ModuleId, StepUiState>,
): string | null {
  for (const seg of segments) {
    if (seg.kind === "combine") {
      const combineUi = stepStates.get(seg.combine.id)
      const inputUi = stepStates.get(seg.input.id)
      const parseUi = seg.parse ? stepStates.get(seg.parse.id) : undefined
      if (combineUi?.status === "running") return combineUi.sub?.label ?? seg.combine.label
      if (inputUi?.status === "running") return inputUi.sub?.label ?? seg.input.label
      if (seg.parse && parseUi?.status === "running") return parseUi.sub?.label ?? seg.parse.label
      continue
    }
    if (seg.kind === "fork") {
      const forkUi = stepStates.get(seg.fork.id)
      for (const b of seg.branches) {
        const nested = firstRunningLabel(b.segments, stepStates)
        if (nested) return nested
      }
      if (forkUi?.status === "running") return forkUi.sub?.label ?? seg.fork.label
      continue
    }
    const moduleUi = stepStates.get(seg.module.id)
    if (moduleUi?.status === "running") return moduleUi.sub?.label ?? seg.module.label
  }
  return null
}
