import type { StepUiState } from "@/lib/run-engine"
import { ModuleKind, RunStepStatus } from "@/lib/types"
import type { PipelineModule } from "@/lib/types"
import { isLlmKind } from "@/lib/module-kinds"
import { isAutoQuoteStep } from "@/lib/quote-steps"
import { isAutoDocToTextStep, isAutoStructureParseStep, isInputManagedFollower } from "@/lib/structure-parse-steps"
import { forkBranchesOf, isExclusiveKind, isNestedLaneKind, locatePipelineModule } from "@/lib/fork-pipeline"
import { followingControlJoin } from "@/lib/exclusive-control"

export type ForkLaneSegment = {
  id: string
  label: string
  modules: PipelineModule[]
  segments: PipelineSegment[]
}

export type PipelineSegment =
  | { kind: "step"; module: PipelineModule; index: number }
  | { kind: "combine"; combine: PipelineModule; input: PipelineModule; convert?: PipelineModule; parse?: PipelineModule; index: number }
  | { kind: "fork"; fork: PipelineModule; index: number; branches: ForkLaneSegment[]; join?: PipelineModule }

export type PipelineInsertLoc = {
  forkId: string
  branchId: string
}

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
// AI : nested forks in a lane render as fork boxes (series-parallel DAG).
export function segmentPipeline(
  modules: PipelineModule[],
  opts?: { nestedForkAsStep?: boolean },
): PipelineSegment[] {
  const nestedForkAsStep = opts?.nestedForkAsStep ?? false
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
      segments.push({ kind: "combine", combine: m, input: g.input, parse: g.parse, convert: g.convert, index: i })
    } else if (!inGroup.has(m.id)) {
      if (isNestedLaneKind(m.kind) && !nestedForkAsStep) {
        const join = isExclusiveKind(m.kind) ? followingControlJoin(modules, i) : undefined
        if (join) inGroup.add(join.id)
        segments.push({
          kind: "fork",
          fork: m,
          index: i,
          join,
          branches: forkBranchesOf(m).map((b) => ({
            id: b.id,
            label: b.label,
            modules: b.modules,
            segments: segmentPipeline(b.modules, { nestedForkAsStep: false }),
          })),
        })
      } else {
        segments.push({ kind: "step", module: m, index: i })
      }
    }
  }
  return segments
}

export function pipelineSegmentKey(seg: PipelineSegment): string {
  if (seg.kind === "combine") return seg.combine.id
  if (seg.kind === "fork") return seg.fork.id
  return seg.module.id
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
  if (seg.kind === "combine") {
    return seg.index - (seg.parse ? 1 : 0) - (seg.convert ? 1 : 0) - 1
  }
  return seg.index
}

export function insertAfterIndex(seg: PipelineSegment): number {
  if (seg.kind === "fork" && seg.join) return seg.index + 2
  return seg.index + 1
}

// AI : modules whose test config belongs on the same aligned row as this canvas segment.
export function modulesInSegment(seg: PipelineSegment): PipelineModule[] {
  if (seg.kind === "combine") {
    return [seg.input, ...(seg.convert ? [seg.convert] : []), ...(seg.parse ? [seg.parse] : []), seg.combine]
  }
  if (seg.kind === "fork") {
    return [seg.fork, ...(seg.join ? [seg.join] : []), ...seg.branches.flatMap((b) => b.segments.flatMap(modulesInSegment))]
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
  const loc = locatePipelineModule(modules, id)
  const siblings = loc?.siblings ?? modules
  const group = combinePairIds(siblings, id)
  if (group.length > 1) return group
  const i = siblings.findIndex((m) => m.id === id)
  if (i < 0) return [id]
  const m = siblings[i]
  if (m.kind === "input") {
    const ids = [m.id]
    let j = i + 1
    while (isInputManagedFollower(siblings[j])) {
      ids.push(siblings[j]!.id)
      j++
    }
    return ids
  }
  if (isInputManagedFollower(m) && i > 0) {
    return managedPipelinePairIds(modules, siblings[i - 1]!.id)
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
