// AI : if/case are exclusive splits. Join is optional — without it the spine stops after the taken arm.
import {
  flattenPipelineModules,
  forkBranchesOf,
  isCaseKind,
  isControlJoinKind,
  isExclusiveKind,
  isIfElseKind,
  isNestedLaneKind,
  laneLastModule,
  makeControlJoinModule,
  type ForkBranch,
} from "@/lib/fork-pipeline"
import { evalIfCondition, ifElseBranch, ifThenBranch, joinIfElseValue } from "@/lib/if-else-pipeline"
import { pickCaseBranch } from "@/lib/case-pipeline"
import { RunStepStatus, type PipelineModule, type RunStep } from "@/lib/types"

export { isCaseKind, isControlJoinKind, isExclusiveKind, makeControlJoinModule }

export function followingControlJoin(modules: PipelineModule[], index: number): PipelineModule | undefined {
  const nxt = modules[index + 1]
  return nxt && isControlJoinKind(nxt.kind) ? nxt : undefined
}

export function exclusiveContinues(modules: PipelineModule[], index: number): boolean {
  return !!followingControlJoin(modules, index)
}

export function pickExclusiveBranch(m: PipelineModule, spine: unknown): ForkBranch | undefined {
  if (isIfElseKind(m.kind)) {
    const takeThen = evalIfCondition(m.ifCondition, spine)
    return takeThen ? ifThenBranch(m) : ifElseBranch(m)
  }
  if (isCaseKind(m.kind)) return pickCaseBranch(m, spine)
  return undefined
}

export function joinExclusiveValue(
  m: PipelineModule,
  spine: unknown,
  byLabel: Record<string, unknown>,
): unknown {
  if (isIfElseKind(m.kind)) return joinIfElseValue(m, spine, byLabel)
  const branch = pickExclusiveBranch(m, spine)
  const last = branch ? laneLastModule(branch) : undefined
  if (!last) return spine
  const value = byLabel[last.label.trim()]
  return value === undefined ? spine : value
}

export function formatExclusiveCondition(m: PipelineModule): string {
  const path = m.ifCondition?.path.trim() ?? ""
  if (isCaseKind(m.kind)) return path ? `case ${path}` : "set match path"
  return path || "set bool path"
}

export function exclusiveLaneKindLabel(m: PipelineModule, index: number, branch: ForkBranch): string {
  if (isIfElseKind(m.kind)) return index === 0 ? "Then" : "Else"
  const match = branch.match?.trim()
  return match || branch.label.trim() || `arm ${index + 1}`
}

export function syncExclusiveControlJoins(modules: PipelineModule[]): PipelineModule[] {
  const out: PipelineModule[] = []
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!
    const next: PipelineModule = isNestedLaneKind(m.kind)
      ? {
          ...m,
          forkBranches: forkBranchesOf(m).map((b) => ({
            ...b,
            modules: syncExclusiveControlJoins(b.modules),
          })),
        }
      : m
    out.push(next)
    if (isExclusiveKind(next.kind)) {
      const nxt = modules[i + 1]
      if (nxt && !isControlJoinKind(nxt.kind)) out.push(makeControlJoinModule())
    }
  }
  return out
}

export function skippedExclusiveModules(m: PipelineModule, taken?: ForkBranch): PipelineModule[] {
  const takenId = taken?.id
  return forkBranchesOf(m).flatMap((b) => (b.id === takenId ? [] : flattenPipelineModules(b.modules)))
}

export function skippedRunStep(module: PipelineModule, inputPreview: string): RunStep {
  return {
    moduleId: module.id,
    kind: module.kind,
    label: module.label,
    status: RunStepStatus.Skipped,
    ms: 0,
    costCents: 0,
    inputPreview,
    outputPreview: "skipped",
  }
}

export function appendSkippedExclusiveArms(steps: RunStep[], m: PipelineModule, taken?: ForkBranch): void {
  for (const skipped of skippedExclusiveModules(m, taken)) {
    if (steps.some((s) => s.moduleId === skipped.id)) continue
    steps.push(skippedRunStep(skipped, `not taken — ${m.label}`))
  }
}

export function appendSkippedSpineAfter(steps: RunStep[], modules: PipelineModule[], exclusiveIndex: number): void {
  for (let j = exclusiveIndex + 1; j < modules.length; j++) {
    for (const skipped of flattenPipelineModules([modules[j]!])) {
      if (steps.some((s) => s.moduleId === skipped.id)) continue
      steps.push(skippedRunStep(skipped, "spine after if/case without Join"))
    }
  }
}
