import { ModuleKind, type PipelineModule } from "../../types"
import { pkFieldOf } from "@/lib/sql-id-types"
import { sqlSeedRowsOf, tableNameForModel } from "@/lib/app-sql"
import {
  defaultSelectSqlForModule,
  derivedInsertSqls,
  shouldDeriveInsertSql,
} from "@/lib/schema-table-fn"
import { allModelsToSql } from "@/lib/sql-schema"
import { execAppSql } from "../../app_sql"
import { materializeHints, materializeStepOutput, modelById, prevModuleFor } from "../helpers"
import { jsonStringifyStepValue } from "../results"
import { stepEmitsList } from "../../type_expr"
import type { ExecResult, RunCtx, RunLogger } from "../engine_types"

type sql_row = Record<string, unknown>

function prevSqlRows(prevValue: unknown): sql_row[] {
  if (Array.isArray(prevValue)) {
    return prevValue.filter((r): r is sql_row => !!r && typeof r === "object" && !Array.isArray(r))
  }
  if (prevValue && typeof prevValue === "object") return [prevValue as sql_row]
  return []
}

export async function pauseForHostedAnimation(m: PipelineModule): Promise<void> {
  // AI : hold after onStep ok so the hosted page can paint the SQL write before the next JSON step.
  if (process.env.VITEST) return
  const ms = Math.min(Math.max(m.avgMs ?? 0, 0), 1600)
  if (ms < 200) return
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function execSqlStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const prev = prevModuleFor(ctx.project.modules, ctx.prevModuleId)
  const prevValue = ctx.prevModuleId ? ctx.outputs.get(ctx.prevModuleId) : undefined
  const out = modelById(ctx.project.models, m.outStructureId)
  const sqls: string[] = []
  // AI : authored SQL runs as Postgres. Empty sql after extract still INSERTs from the previous row(s).
  if (m.sql?.trim()) {
    sqls.push(m.sql.trim())
  } else if (shouldDeriveInsertSql(prev, m) && out && prevValue != null) {
    sqls.push(...derivedInsertSqls(out, prevValue))
  }
  if (!sqls.length) {
    const select = defaultSelectSqlForModule(m, ctx.project.models)
    if (select) sqls.push(select)
  }
  if (!sqls.length) throw new Error(`sql step "${m.label}" has no SQL`)
  const scope = ctx.appSqlScope
  if (!scope) throw new Error(`sql step "${m.label}" has no app SQL scope`)
  const pkField = out ? pkFieldOf(out)?.name ?? "id" : "id"
  const table = out ? tableNameForModel(out) : undefined
  const schemaSql = allModelsToSql(ctx.project.models, ctx.project.modules)
  const bindRows = prevSqlRows(prevValue)
  log.info(`sql step`, { moduleId: m.id, scope, table, sql: sqls.join("; ") })
  const rows: Record<string, unknown>[] = []
  for (const sql of sqls) {
    rows.push(
      ...(await execAppSql(scope, sql, {
        seedRows: sqlSeedRowsOf(m),
        pkField,
        bindRows,
        schemaSql,
      })),
    )
  }
  const raw = stepEmitsList(m) || rows.length > 1 ? rows : (rows[0] ?? {})
  const value = out
    ? materializeStepOutput(m, ctx.project, raw, materializeHints(m, ctx), prev)
    : raw
  return {
    value,
    preview: table ? `sql ${table} → ${rows.length} row(s)` : `sql → ${rows.length} row(s)`,
    json: jsonStringifyStepValue(value),
    inputPreview: sqls.join("\n"),
  }
}

export function isSqlModuleKind(kind: string): boolean {
  return kind === ModuleKind.Sql || kind === "sql"
}
