// AI : shared progress helpers for global run job tracking.
import { segmentPipeline } from "@/lib/pipeline-layout"
import type { StepUiState } from "@/lib/run-engine"
import type { ModuleId, PipelineModule } from "@/lib/types"

export function progressPctFromStepStates(
  modules: PipelineModule[],
  stepStates: Map<ModuleId, StepUiState>,
): number {
  const done = modules.filter((m) => {
    const s = stepStates.get(m.id)?.status
    return s !== undefined && s !== "idle" && s !== "running"
  }).length
  return Math.round((done / Math.max(1, modules.length)) * 100)
}

export function activeStepLabelFromStepStates(
  modules: PipelineModule[],
  stepStates: Map<ModuleId, StepUiState>,
): string | null {
  for (const seg of segmentPipeline(modules)) {
    if (seg.kind === "combine") {
      const combineUi = stepStates.get(seg.combine.id)
      const inputUi = stepStates.get(seg.input.id)
      const parseUi = seg.parse ? stepStates.get(seg.parse.id) : undefined
      if (combineUi?.status === "running") return combineUi.sub?.label ?? seg.combine.label
      if (inputUi?.status === "running") return inputUi.sub?.label ?? seg.input.label
      if (seg.parse && parseUi?.status === "running") return parseUi.sub?.label ?? seg.parse.label
      continue
    }
    const moduleUi = stepStates.get(seg.module.id)
    if (moduleUi?.status === "running") return moduleUi.sub?.label ?? seg.module.label
  }
  return null
}
