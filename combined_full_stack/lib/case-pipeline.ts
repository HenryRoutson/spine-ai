// AI : N-way exclusive match — discriminant path on the spine; arm.match is the case value.
import { forkBranchesOf, makeEmptyForkBranch, type ForkBranch } from "@/lib/fork-pipeline"
import { IfConditionKind, type PipelineModule } from "@/lib/types"
import { readDotPathValue } from "@/lib/type-expr-polymorph"

export const CASE_DEFAULT_MATCHES = new Set(["", "_", "*", "default"])

export function isDefaultCaseMatch(match?: string): boolean {
  return CASE_DEFAULT_MATCHES.has((match ?? "").trim().toLowerCase())
}

export function defaultCaseBranches(): ForkBranch[] {
  return [
    { ...makeEmptyForkBranch("Arm A"), match: "a" },
    { ...makeEmptyForkBranch("Default"), match: "_" },
  ]
}

export function padCaseBranches(branches?: ForkBranch[]): ForkBranch[] {
  if (branches && branches.length >= 2) {
    return branches.map((b, i) => ({
      ...b,
      label: b.label.trim() || (isDefaultCaseMatch(b.match) ? "Default" : `Arm ${i + 1}`),
    }))
  }
  return defaultCaseBranches()
}

export function caseDiscriminant(spine: unknown, path: string): string {
  const got = readDotPathValue(spine, path)
  if (got === null || got === undefined) return ""
  if (typeof got === "boolean" || typeof got === "number" || typeof got === "string") return String(got)
  throw new Error(`case path "${path}" must be a scalar, got ${typeof got}`)
}

export function pickCaseBranch(m: PipelineModule, spine: unknown): ForkBranch | undefined {
  const path = m.ifCondition?.path.trim() ?? ""
  if (!path) throw new Error("case needs a match path on the spine")
  const key = caseDiscriminant(spine, path)
  const branches = forkBranchesOf(m)
  const hit = branches.find((b) => !isDefaultCaseMatch(b.match) && (b.match ?? "").trim() === key)
  if (hit) return hit
  return branches.find((b) => isDefaultCaseMatch(b.match))
}

export function evalCaseMatch(m: PipelineModule, spine: unknown): string {
  return pickCaseBranch(m, spine)?.label.trim() || "default"
}

export function defaultCaseCondition(): { kind: typeof IfConditionKind.Path; path: string } {
  return { kind: IfConditionKind.Path, path: "" }
}
