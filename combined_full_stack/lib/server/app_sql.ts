// AI : hosted-app SQL — SQLite engine so vibe-written SQL (JOIN, ?, aggregations) actually runs.
import { sqlSeedRowsOf, type app_sql_scope } from "@/lib/app-sql"
import {
  execSqlite,
  listSqliteRows,
  resetAppSqliteForTests,
  upsertSqliteRow,
  type ExecSqliteOpts,
} from "./app_sqlite"

type sql_row = Record<string, unknown>

export function resetAppSqlForTests(): void {
  resetAppSqliteForTests()
}

export async function listAppSqlRows(scope: app_sql_scope | string, table: string): Promise<sql_row[]> {
  return listSqliteRows(scope, table)
}

export async function upsertAppSqlRow(
  scope: app_sql_scope | string,
  table: string,
  row: sql_row,
  pkField = "id",
): Promise<sql_row> {
  return upsertSqliteRow(scope, table, row, pkField)
}

export async function ensureAppSqlSeed(
  scope: app_sql_scope | string,
  table: string,
  seedRows: sql_row[],
  pkField = "id",
): Promise<sql_row[]> {
  const existing = await listAppSqlRows(scope, table)
  if (existing.length > 0 || seedRows.length === 0) return existing
  const out: sql_row[] = []
  for (const row of seedRows) out.push(await upsertAppSqlRow(scope, table, row, pkField))
  return out
}

export async function execAppSql(
  scope: app_sql_scope | string,
  sql: string,
  opts?: ExecSqliteOpts,
): Promise<sql_row[]> {
  return execSqlite(scope, sql, opts)
}

export { sqlSeedRowsOf }
