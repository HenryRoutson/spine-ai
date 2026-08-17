import type { StepUiState } from "@/lib/run-engine"
import { RunStepStatus } from "@/lib/types"
import type { PipelineModule } from "@/lib/types"
import { isLlmKind } from "@/lib/module-kinds"
import { isAutoQuoteStep } from "@/lib/quote-steps"
import { isAutoDocToTextStep, isAutoStructureParseStep, isInputManagedFollower } from "@/lib/structure-parse-steps"

export type PipelineSegment =
  | { kind: "step"; module: PipelineModule; index: number }
  | { kind: "combine"; combine: PipelineModule; input: PipelineModule; convert?: PipelineModule; parse?: PipelineModule; index: number }

// AI : TODO(spec) — delete combine segments when implicit combine ships (pipeline_state.ts #10).
// AI : second+ input steps stand alone; canvas shows label-keyed state arrows instead.

// AI : combine groups are [input, convert?, autoParseLlm?, combine].
export function combineGroupAt(
  modules: PipelineModule[],
  i: number,
): { input: PipelineModule; convert?: PipelineModule; parse?: PipelineModule } | undefined {
  if (modules[i]?.kind !== "combine") return undefined
  let j = i - 1
  let parse: PipelineModule | undefined
  let convert: PipelineModule | undefined
  while (j >= 0 && isInputManagedFollower(modules[j])) {
    const m = modules[j]!
    if (isAutoStructureParseStep(m)) parse = m
    if (isAutoDocToTextStep(m)) convert = m
    j--
  }
  if (modules[j]?.kind === "input") return { input: modules[j]!, convert, parse }
  return undefined
}

// AI : combine steps consume pipeline state + a secondary input module immediately before them —
// AI : group input (+ auto parse llm) so the linear canvas shows where the extra document feeds in.
export function segmentPipeline(modules: PipelineModule[]): PipelineSegment[] {
  const inGroup = new Set<string>()
  for (let i = 0; i < modules.length; i++) {
    const g = combineGroupAt(modules, i)
    if (g) {
      inGroup.add(g.input.id)
      if (g.convert) inGroup.add(g.convert.id)
      if (g.parse) inGroup.add(g.parse.id)
    }
  }
  const segments: PipelineSegment[] = []
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]
    const g = combineGroupAt(modules, i)
    if (g) {
      segments.push({ kind: "combine", combine: m, input: g.input, parse: g.parse, index: i })
    } else if (!inGroup.has(m.id)) {
      segments.push({ kind: "step", module: m, index: i })
    }
  }
  return segments
}

// AI : move/remove treat the secondary input (+ auto parse llm) + combine as one block.
export function combinePairIds(modules: PipelineModule[], id: string): string[] {
  const i = modules.findIndex((m) => m.id === id)
  if (i < 0) return [id]
  for (let c = i; c <= i + 2 && c < modules.length; c++) {
    const g = combineGroupAt(modules, c)
    if (!g) continue
    const ids: string[] = [
      g.input.id,
      ...(g.convert ? [g.convert.id] : []),
      ...(g.parse ? [g.parse.id] : []),
      modules[c]!.id,
    ]
    if (ids.includes(id)) return ids
  }
  return [id]
}

export function insertBeforeIndex(seg: PipelineSegment): number {
  return seg.kind === "combine"
    ? seg.index - (seg.parse ? 1 : 0) - (seg.convert ? 1 : 0) - 1
    : seg.index
}

export function insertAfterIndex(seg: PipelineSegment): number {
  return seg.index + 1
}

// AI : modules whose test config belongs on the same aligned row as this canvas segment.
export function modulesInSegment(seg: PipelineSegment): PipelineModule[] {
  if (seg.kind === "combine") {
    return [seg.input, ...(seg.convert ? [seg.convert] : []), ...(seg.parse ? [seg.parse] : []), seg.combine]
  }
  return [seg.module]
}

// AI : combine steps consume the input module just before them (auto parse llm may sit between) —
// AI : pin uploads on that input's label.
export function pairedCombineInputModule(
  combine: PipelineModule,
  modules: PipelineModule[],
): PipelineModule | undefined {
  const i = modules.findIndex((m) => m.id === combine.id)
  if (combine.kind !== "combine" || i <= 0) return undefined
  return combineGroupAt(modules, i)?.input
}

// AI : don't offer an insert slot between managed auto-step pairs.
export function blocksInsertBefore(modules: PipelineModule[], insertAt: number): boolean {
  if (insertAt <= 0 || insertAt >= modules.length) return false
  const prev = modules[insertAt - 1]
  const next = modules[insertAt]
  return (
    (isLlmKind(prev.kind) && isAutoQuoteStep(next)) ||
    (prev.kind === "input" && isInputManagedFollower(next)) ||
    (isAutoDocToTextStep(prev) && isAutoStructureParseStep(next))
  )
}

// AI : input + auto structure LLM, or combine group (input [+ parse] + combine), move/remove as one block.
export function managedPipelinePairIds(modules: PipelineModule[], id: string): string[] {
  const group = combinePairIds(modules, id)
  if (group.length > 1) return group
  const i = modules.findIndex((m) => m.id === id)
  if (i < 0) return [id]
  const m = modules[i]
  if (m.kind === "input") {
    const ids = [m.id]
    let j = i + 1
    while (isInputManagedFollower(modules[j])) {
      ids.push(modules[j]!.id)
      j++
    }
    return ids
  }
  if (isInputManagedFollower(m) && i > 0) {
    return managedPipelinePairIds(modules, modules[i - 1]!.id)
  }
  return [id]
}

type StepUiStatus = StepUiState["status"]

// AI : combine rows show merged status on the combine step; input keeps its own state.
export function mergeCombineSegmentStatus(
  combineStatus: StepUiStatus,
  inputStatus: StepUiStatus,
): StepUiStatus {
  if (combineStatus === "error" || inputStatus === "error") return RunStepStatus.Error
  if (combineStatus === "running" || inputStatus === "running") return "running"
  if (combineStatus === "cached" || inputStatus === "cached") return RunStepStatus.Cached
  if (combineStatus !== "idle" || inputStatus !== "idle") return RunStepStatus.Ok
  return "idle"
}
