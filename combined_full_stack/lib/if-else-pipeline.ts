// AI : exclusive Then/Else lanes — condition is a typed spine path (bool) or field equals.
import { readDotPathValue } from "@/lib/type-expr-polymorph"
import {
  forkBranchesOf,
  laneLastModule,
  makeEmptyForkBranch,
  type ForkBranch,
} from "@/lib/fork-pipeline"
import { IfConditionKind, type IfCondition, type PipelineModule } from "@/lib/types"

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

export function defaultIfCondition(): IfCondition {
  return { kind: IfConditionKind.Path, path: "" }
}

export function ifThenBranch(m: PipelineModule): ForkBranch | undefined {
  return forkBranchesOf(m)[0]
}

export function ifElseBranch(m: PipelineModule): ForkBranch | undefined {
  return forkBranchesOf(m)[1]
}

export function formatIfCondition(cond?: IfCondition): string {
  const path = cond?.path.trim() ?? ""
  if (!path) return "set condition"
  if (cond?.kind === IfConditionKind.Equals) return `${path} === ${JSON.stringify(cond.value)}`
  return path
}

function jsonEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export function evalIfCondition(cond: IfCondition | undefined, spine: unknown): boolean {
  const path = cond?.path.trim() ?? ""
  if (!path) throw new Error("if/else needs a condition path")
  const got = readDotPathValue(spine, path)
  if (cond?.kind === IfConditionKind.Equals) return jsonEqual(got, cond.value)
  if (typeof got !== "boolean") {
    throw new Error(`if/else path "${path}" must be bool, got ${got === null ? "null" : typeof got}`)
  }
  return got
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
