import { evalSqlExpr, parseAppSql, type SqlExpr } from "@/lib/app-sql"
import { ifElseBranch, ifThenBranch, evalIfCondition } from "@/lib/if-else-pipeline"
import { parseHostedNumber, type hosted_arith_step, type hosted_preview_line } from "@/lib/hosted-collatz"
import { hostedActionPayload, type HostedSiteActionBinding } from "@/lib/hosted-site-actions"
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

// AI : walk pipeline JSON — if/else + SQL. Trigger fields come from the action binding.
export function hostedPipelineArithPreview(
  modules: PipelineModule[],
  action: string,
  n: number,
  payload: Record<string, unknown> = {},
): hosted_pipeline_step[] {
  const row: Record<string, unknown> = { id: "global", value: n, odd: n % 2 === 1 }
  const steps: hosted_pipeline_step[] = []
  walk(modules, action, payload, row, steps)
  return steps
}

export function hostedPipelineArithPreviewForBinding(
  modules: PipelineModule[],
  binding: HostedSiteActionBinding,
  n: number,
): hosted_pipeline_step[] {
  return hostedPipelineArithPreview(modules, binding.alias, n, hostedActionPayload(binding))
}

function walk(
  modules: PipelineModule[],
  action: string,
  payload: Record<string, unknown>,
  row: Record<string, unknown>,
  steps: hosted_pipeline_step[],
): void {
  for (const m of modules) {
    if (isIfElse(m)) {
      const spine = { ...row, action, ...payload }
      let takeThen = false
      try {
        takeThen = evalIfCondition(m.ifCondition, spine)
      } catch {
        continue
      }
      const branch = takeThen ? ifThenBranch(m) : ifElseBranch(m)
      if (branch) walk(branch.modules, action, payload, row, steps)
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
    // AI : Odd? SQL writes value % 2 as 0/1; if/else on odd needs a bool.
    if (typeof row.odd === "number") row.odd = row.odd === 1
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
  action: string,
  n: number | null,
  payload: Record<string, unknown> = {},
): hosted_preview_line[] {
  if (n == null || modules.length === 0) return []
  return hostedPipelineArithPreview(modules, action, n, payload).map((step) => ({
    expr: step.expr,
    result: String(step.to),
  }))
}

export type hosted_pipeline_trace_row = hosted_pipeline_step & { state: StepUiState["status"] | "idle" }

export function hostedPipelineTraceRows(
  planned: hosted_pipeline_step[],
  stepStates: Map<ModuleId, StepUiState>,
): hosted_pipeline_trace_row[] {
  return planned.map((step) => ({
    ...step,
    state: stepStates.get(step.moduleId)?.status ?? "idle",
  }))
}
