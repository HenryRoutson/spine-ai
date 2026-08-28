import { evalSqlExpr, parseAppSql, type SqlExpr } from "@/lib/app-sql"
import { ifElseBranch, ifThenBranch, evalIfCondition } from "@/lib/if-else-pipeline"
import { parseHostedNumber, type hosted_action_kind, type hosted_arith_step, type hosted_preview_line } from "@/lib/hosted-collatz"
import { ModuleKind, type ModuleId, type PipelineModule } from "@/lib/types"
import type { StepUiState } from "@/lib/run-engine"

const OP_GLYPH: Record<string, string> = { "*": "×", "/": "÷", "+": "+", "-": "−", "%": "%" }

function tryParseSql(sql: string | undefined): ReturnType<typeof parseAppSql> | null {
  if (!sql?.trim()) return null
  try {
    return parseAppSql(sql)
  } catch {
    return null
  }
}

function isIfElse(m: PipelineModule): boolean {
  return m.kind === ModuleKind.IfElse
}

function isSql(m: PipelineModule): boolean {
  return m.kind === ModuleKind.Sql
}

function formatSqlExpr(expr: SqlExpr, row: Record<string, unknown>): string {
  if (expr.kind === "lit") return String(expr.value)
  if (expr.kind === "col") {
    const n = parseHostedNumber(row[expr.name])
    if (n != null) return String(n)
    return expr.name === "value" ? "n" : expr.name
  }
  const glyph = OP_GLYPH[expr.op] ?? expr.op
  const left = expr.left.kind === "binary" ? `(${formatSqlExpr(expr.left, row)})` : formatSqlExpr(expr.left, row)
  const right = expr.right.kind === "binary" ? `(${formatSqlExpr(expr.right, row)})` : formatSqlExpr(expr.right, row)
  return `${left} ${glyph} ${right}`
}

export function valueUpdateExpr(m: PipelineModule): SqlExpr | null {
  const parsed = tryParseSql(m.sql)
  if (!parsed || parsed.kind !== "update") return null
  return parsed.set.find((s) => s.field === "value")?.expr ?? null
}

export type hosted_pipeline_step = hosted_arith_step & { moduleId: ModuleId }

// AI : walk the pipeline JSON the same way the engine does — if-else + SQL — no extra Collatz math.
export function hostedPipelineArithPreview(
  modules: PipelineModule[],
  action: hosted_action_kind,
  n: number,
): hosted_pipeline_step[] {
  const row: Record<string, unknown> = { id: "global", value: n, odd: n % 2 }
  const steps: hosted_pipeline_step[] = []
  walk(modules, action, row, steps)
  return steps
}

function walk(
  modules: PipelineModule[],
  action: hosted_action_kind,
  row: Record<string, unknown>,
  steps: hosted_pipeline_step[],
): void {
  for (const m of modules) {
    if (isIfElse(m)) {
      const spine = { ...row, action }
      let takeThen = false
      try {
        takeThen = evalIfCondition(m.ifCondition, spine)
      } catch {
        continue
      }
      const branch = takeThen ? ifThenBranch(m) : ifElseBranch(m)
      if (branch) walk(branch.modules, action, row, steps)
      continue
    }
    if (!isSql(m)) continue
    const parsed = tryParseSql(m.sql)
    if (!parsed || parsed.kind !== "update") continue
    const before = { ...row }
    try {
      for (const set of parsed.set) {
        row[set.field] = evalSqlExpr(set.expr, before)
      }
    } catch {
      continue
    }
    const valueExpr = parsed.set.find((s) => s.field === "value")?.expr
    if (!valueExpr) continue
    const from = parseHostedNumber(before.value)
    const to = parseHostedNumber(row.value)
    if (from == null || to == null) continue
    steps.push({ moduleId: m.id, label: m.label, from, to, expr: formatSqlExpr(valueExpr, before) })
  }
}

export function hostedPipelinePreviewLines(
  modules: PipelineModule[],
  action: hosted_action_kind,
  n: number | null,
): hosted_preview_line[] {
  if (n == null || modules.length === 0) return []
  return hostedPipelineArithPreview(modules, action, n).map((step) => ({
    expr: step.expr,
    result: String(step.to),
  }))
}

export function hostedPipelineTraceRows(
  planned: hosted_pipeline_step[],
  stepStates: Map<ModuleId, StepUiState>,
): { id: ModuleId; label: string; state: StepUiState["status"] | "idle" }[] {
  return planned.map((step) => ({
    id: step.moduleId,
    label: step.label,
    state: stepStates.get(step.moduleId)?.status ?? "idle",
  }))
}
