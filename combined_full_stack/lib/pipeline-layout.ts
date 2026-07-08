import type { StepUiState } from "@/lib/run-engine"
import { RunStepStatus } from "@/lib/types"
import type { PipelineModule } from "@/lib/types"
import { isLlmKind } from "@/lib/module-kinds"
import { isAutoQuoteStep } from "@/lib/quote-steps"
import { isAutoStructureParseStep } from "@/lib/structure-parse-steps"

export type PipelineSegment =
  | { kind: "step"; module: PipelineModule; index: number }
  | { kind: "combine"; combine: PipelineModule; input: PipelineModule; parse?: PipelineModule; index: number }

// AI : TODO(spec) — delete combine segments when implicit combine ships (pipeline_state.ts #10).
// AI : second+ input steps stand alone; canvas shows label-keyed state arrows instead.

// AI : combine groups are [input, autoParseLlm?, combine] — the sync inserts a locked LLM between
// AI : the side input and the combine when the input needs conversion to a non-Document structure.
export function combineGroupAt(
  modules: PipelineModule[],
  i: number,
): { input: PipelineModule; parse?: PipelineModule } | undefined {
  if (modules[i]?.kind !== "combine") return undefined
  const prev = modules[i - 1]
  if (prev?.kind === "input") return { input: prev }
  if (prev && isAutoStructureParseStep(prev) && modules[i - 2]?.kind === "input") {
    return { input: modules[i - 2]!, parse: prev }
  }
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
    const ids: string[] = [g.input.id, ...(g.parse ? [g.parse.id] : []), modules[c]!.id]
    if (ids.includes(id)) return ids
  }
  return [id]
}

export function insertBeforeIndex(seg: PipelineSegment): number {
  return seg.kind === "combine" ? seg.index - (seg.parse ? 2 : 1) : seg.index
}

export function insertAfterIndex(seg: PipelineSegment): number {
  return seg.index + 1
}

// AI : modules whose test config belongs on the same aligned row as this canvas segment.
export function modulesInSegment(seg: PipelineSegment): PipelineModule[] {
  if (seg.kind === "combine") return [seg.input, ...(seg.parse ? [seg.parse] : []), seg.combine]
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
    (prev.kind === "input" && isAutoStructureParseStep(next))
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
    const next = modules[i + 1]
    if (next && isAutoStructureParseStep(next)) return [m.id, next.id]
  }
  if (isAutoStructureParseStep(m)) {
    const prev = modules[i - 1]
    if (prev?.kind === "input") return [prev.id, m.id]
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
