// AI : hosted-app SQL — Postgres (PGlite in tests, pg → Supabase when a DB URL is up).
import { sqlSeedRowsOf, type app_sql_scope } from "@/lib/app-sql"
import {
  execPostgres,
  listPostgresRows,
  preferLivePostgres,
  resetAppPostgresForTests,
  resetAppPostgresForTestsAsync,
  upsertPostgresRow,
  preparePostgresSql,
  appSqlEngineKind,
  type ExecPostgresOpts,
} from "./app_postgres"

type sql_row = Record<string, unknown>

export type ExecAppSqlOpts = ExecPostgresOpts

export function resetAppSqlForTests(): void {
  resetAppPostgresForTests()
}

export async function resetAppSqlForTestsAsync(): Promise<void> {
  await resetAppPostgresForTestsAsync()
}

export { preferLivePostgres, preparePostgresSql as prepareAppSql, appSqlEngineKind }

export async function listAppSqlRows(scope: app_sql_scope | string, table: string): Promise<sql_row[]> {
  return listPostgresRows(scope, table)
}

export async function upsertAppSqlRow(
  scope: app_sql_scope | string,
  table: string,
  row: sql_row,
  pkField = "id",
): Promise<sql_row> {
  return upsertPostgresRow(scope, table, row, pkField)
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
  opts?: ExecAppSqlOpts,
): Promise<sql_row[]> {
  return execPostgres(scope, sql, opts)
}

export { sqlSeedRowsOf }
