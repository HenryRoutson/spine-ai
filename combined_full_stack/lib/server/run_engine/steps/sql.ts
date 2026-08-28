import { ModuleKind, type PipelineModule } from "../../types"
import { pkFieldOf } from "@/lib/sql-id-types"
import { sqlSeedRowsOf, tableNameForModel } from "@/lib/app-sql"
import { execAppSql } from "../../app_sql"
import { materializeHints, materializeStepOutput, modelById, prevModuleFor } from "../helpers"
import { jsonStringifyStepValue } from "../results"
import { stepEmitsList } from "../../type_expr"
import type { ExecResult, RunCtx, RunLogger } from "../engine_types"

async function pauseForHostedAnimation(m: PipelineModule): Promise<void> {
  // AI : avgMs on demo SQL steps is a visible pause so hosted simple-view traces can tick per step.
  if (process.env.VITEST) return
  const ms = Math.min(Math.max(m.avgMs ?? 0, 0), 1600)
  if (ms < 200) return
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function execSqlStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const sql = m.sql?.trim()
  if (!sql) throw new Error(`sql step "${m.label}" has no SQL`)
  const scope = ctx.appSqlScope
  if (!scope) throw new Error(`sql step "${m.label}" has no app SQL scope`)
  await pauseForHostedAnimation(m)
  const out = modelById(ctx.project.models, m.outStructureId)
  const pkField = out ? pkFieldOf(out)?.name ?? "id" : "id"
  const table = out ? tableNameForModel(out) : undefined
  log.info(`sql step`, { moduleId: m.id, scope, table, sql })
  const rows = await execAppSql(scope, sql, { seedRows: sqlSeedRowsOf(m), pkField })
  const raw = stepEmitsList(m) ? rows : (rows[0] ?? {})
  const prev = prevModuleFor(ctx.project.modules, ctx.prevModuleId)
  const value = out
    ? materializeStepOutput(m, ctx.project, raw, materializeHints(m, ctx), prev)
    : raw
  return {
    value,
    preview: table ? `sql ${table} → ${rows.length} row(s)` : `sql → ${rows.length} row(s)`,
    json: jsonStringifyStepValue(value),
    inputPreview: sql,
  }
}

export function isSqlModuleKind(kind: string): boolean {
  return kind === ModuleKind.Sql || kind === "sql"
}
