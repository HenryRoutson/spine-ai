// AI : exclusive Then/Else lanes — typed condition lives in if-condition.ts.
import {
  forkBranchesOf,
  laneLastModule,
  makeEmptyForkBranch,
  type ForkBranch,
} from "@/lib/fork-pipeline"
import type { PipelineModule } from "@/lib/types"
import { evalIfCondition } from "@/lib/if-condition"

export { defaultIfCondition, evalIfCondition, formatIfCondition } from "@/lib/if-condition"

export const IF_THEN_LABEL = "Then"
export const IF_ELSE_LABEL = "Else"

export function padIfElseBranches(branches?: ForkBranch[]): ForkBranch[] {
  const thenB = branches?.[0] ?? makeEmptyForkBranch(IF_THEN_LABEL)
  const elseB = branches?.[1] ?? makeEmptyForkBranch(IF_ELSE_LABEL)
  return [
    { ...thenB, label: thenB.label.trim() || IF_THEN_LABEL },
    { ...elseB, label: elseB.label.trim() || IF_ELSE_LABEL },
  ]
}

export function defaultIfElseBranches(): ForkBranch[] {
  return padIfElseBranches()
}

export function ifThenBranch(m: PipelineModule): ForkBranch | undefined {
  return forkBranchesOf(m)[0]
}

export function ifElseBranch(m: PipelineModule): ForkBranch | undefined {
  return forkBranchesOf(m)[1]
}

export function joinIfElseValue(
  m: PipelineModule,
  spine: unknown,
  byLabel: Record<string, unknown>,
): unknown {
  const takeThen = evalIfCondition(m.ifCondition, spine)
  const branch = takeThen ? ifThenBranch(m) : ifElseBranch(m)
  const last = branch ? laneLastModule(branch) : undefined
  if (!last) return spine
  const value = byLabel[last.label.trim()]
  return value === undefined ? spine : value
}
