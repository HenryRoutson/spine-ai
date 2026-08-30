// AI : hosted-app SQL rows — Postgres when available, file+memory otherwise.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { dataDir } from "./config"
import { createAdminClient } from "./supabase_admin"
import { isMissingSchemaError } from "./supabase_store"
import { logger } from "./server_logger"
import {
  evalSqlExpr,
  parseAppSql,
  projectSqlColumns,
  rowIdOf,
  sqlWhereMatches,
  type ParsedAppSql,
  type app_sql_row_id,
  type app_sql_scope,
} from "@/lib/app-sql"

type sql_row = Record<string, unknown>
type table_map = Map<app_sql_row_id, sql_row>
type scope_map = Map<string, table_map>

const memory = new Map<string, scope_map>()
let testMode = false
let fileLoaded = false

const log = logger("app-sql")

export class AppSqlUnavailableError extends Error {
  readonly code = "app_sql_unavailable" as const
  constructor(detail?: string) {
    super(
      detail
        ? `Hosted SQL is unavailable (${detail}). Apply pending Supabase migrations including public.app_sql_rows.`
        : "Hosted SQL is unavailable. Apply pending Supabase migrations including public.app_sql_rows.",
    )
    this.name = "AppSqlUnavailableError"
  }
}

// AI : Vercel /tmp is per-instance — never pretend file+memory is a durable website store.
export function appSqlAllowsEphemeralFallback(): boolean {
  return !process.env.VERCEL
}

function requireDurableAppSql(detail?: string): void {
  if (testMode || appSqlAllowsEphemeralFallback()) return
  throw new AppSqlUnavailableError(detail)
}

export function resetAppSqlForTests(): void {
  testMode = true
  fileLoaded = true
  memory.clear()
}

function filePath(): string {
  return join(dataDir(), "app_sql.json")
}

function loadFile(): void {
  if (testMode || fileLoaded) return
  fileLoaded = true
  const path = filePath()
  if (!existsSync(path)) return
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, Record<string, Record<string, sql_row>>>
    for (const [scope, tables] of Object.entries(raw ?? {})) {
      const tableMap: scope_map = new Map()
      for (const [table, rows] of Object.entries(tables ?? {})) {
        const rowMap: table_map = new Map()
        for (const [id, data] of Object.entries(rows ?? {})) {
          rowMap.set(id as app_sql_row_id, { ...data })
        }
        tableMap.set(table, rowMap)
      }
      memory.set(scope, tableMap)
    }
  } catch (err) {
    log.warn(`failed to load app_sql.json`, { error: (err as Error).message })
  }
}

function persistFile(): void {
  if (testMode) return
  const out: Record<string, Record<string, Record<string, sql_row>>> = {}
  for (const [scope, tables] of memory) {
    const t: Record<string, Record<string, sql_row>> = {}
    for (const [table, rows] of tables) {
      const r: Record<string, sql_row> = {}
      for (const [id, data] of rows) r[id] = data
      t[table] = r
    }
    out[scope] = t
  }
  const path = filePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(out, null, 2))
}

function memTable(scope: string, table: string): table_map {
  loadFile()
  let tables = memory.get(scope)
  if (!tables) {
    tables = new Map()
    memory.set(scope, tables)
  }
  let rows = tables.get(table)
  if (!rows) {
    rows = new Map()
    tables.set(table, rows)
  }
  return rows
}

async function dbList(scope: string, table: string): Promise<sql_row[] | null> {
  if (testMode) return null
  const db = await createAdminClient()
  if (!db) {
    requireDurableAppSql("no service-role client")
    return null
  }
  const { data, error } = await db
    .from("app_sql_rows")
    .select("row_id, data")
    .eq("scope", scope)
    .eq("table_name", table)
  if (error) {
    if (isMissingSchemaError(error)) {
      requireDurableAppSql(error.message)
      return null
    }
    log.warn(`list failed`, { error: error.message })
    requireDurableAppSql(error.message)
    return null
  }
  return (data ?? []).map((row) => ({
    ...((row.data && typeof row.data === "object" ? row.data : {}) as sql_row),
    id: (row as { row_id?: string }).row_id,
  }))
}

async function dbDelete(scope: string, table: string, rowId: string): Promise<boolean> {
  if (testMode) return false
  const db = await createAdminClient()
  if (!db) {
    requireDurableAppSql("no service-role client")
    return false
  }
  const { error } = await db
    .from("app_sql_rows")
    .delete()
    .eq("scope", scope)
    .eq("table_name", table)
    .eq("row_id", rowId)
  if (error) {
    if (isMissingSchemaError(error)) {
      requireDurableAppSql(error.message)
      return false
    }
    log.warn(`delete failed`, { error: error.message })
    requireDurableAppSql(error.message)
    return false
  }
  return true
}

async function dbUpsert(scope: string, table: string, rowId: string, data: sql_row): Promise<boolean> {
  if (testMode) return false
  const db = await createAdminClient()
  if (!db) {
    requireDurableAppSql("no service-role client")
    return false
  }
  const { error } = await db.from("app_sql_rows").upsert(
    {
      scope,
      table_name: table,
      row_id: rowId,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "scope,table_name,row_id" },
  )
  if (error) {
    if (isMissingSchemaError(error)) {
      requireDurableAppSql(error.message)
      return false
    }
    log.warn(`upsert failed`, { error: error.message })
    requireDurableAppSql(error.message)
    return false
  }
  return true
}

export async function listAppSqlRows(scope: app_sql_scope | string, table: string): Promise<sql_row[]> {
  const fromDb = await dbList(scope, table)
  if (fromDb) {
    const rows = memTable(scope, table)
    rows.clear()
    for (const row of fromDb) {
      try {
        rows.set(rowIdOf(row), { ...row })
      } catch {
        // AI : skip rows without a pk — should not happen for seeded tables.
      }
    }
    return fromDb
  }
  return [...memTable(scope, table).values()].map((row) => ({ ...row }))
}

export async function deleteAppSqlRow(
  scope: app_sql_scope | string,
  table: string,
  row: sql_row,
  pkField = "id",
): Promise<sql_row> {
  const id = rowIdOf(row, pkField)
  memTable(scope, table).delete(id)
  const ok = await dbDelete(scope, table, id)
  if (!ok) {
    requireDurableAppSql()
    persistFile()
  }
  return row
}

export async function upsertAppSqlRow(
  scope: app_sql_scope | string,
  table: string,
  row: sql_row,
  pkField = "id",
): Promise<sql_row> {
  const id = rowIdOf(row, pkField)
  const next = { ...row }
  memTable(scope, table).set(id, next)
  const ok = await dbUpsert(scope, table, id, next)
  if (!ok) {
    requireDurableAppSql()
    persistFile()
  }
  return next
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

function applySelect(stmt: Extract<ParsedAppSql, { kind: "select" }>, rows: sql_row[]): sql_row[] {
  return rows.filter((row) => sqlWhereMatches(row, stmt.where)).map((row) => projectSqlColumns(row, stmt.columns))
}

export async function execAppSql(
  scope: app_sql_scope | string,
  sql: string,
  opts?: { seedRows?: sql_row[]; pkField?: string },
): Promise<sql_row[]> {
  const stmt = parseAppSql(sql)
  const pkField = opts?.pkField ?? "id"
  if (stmt.kind === "select") {
    await ensureAppSqlSeed(scope, stmt.table, opts?.seedRows ?? [], pkField)
    return applySelect(stmt, await listAppSqlRows(scope, stmt.table))
  }
  if (stmt.kind === "insert") {
    const row: sql_row = {}
    stmt.columns.forEach((col, i) => {
      row[col] = stmt.values[i] ?? null
    })
    return [await upsertAppSqlRow(scope, stmt.table, row, pkField)]
  }
  if (stmt.kind === "delete") {
    await ensureAppSqlSeed(scope, stmt.table, opts?.seedRows ?? [], pkField)
    const rows = (await listAppSqlRows(scope, stmt.table)).filter((row) => sqlWhereMatches(row, stmt.where))
    for (const row of rows) await deleteAppSqlRow(scope, stmt.table, row, pkField)
    return rows
  }
  await ensureAppSqlSeed(scope, stmt.table, opts?.seedRows ?? [], pkField)
  let rows = (await listAppSqlRows(scope, stmt.table)).filter((row) => sqlWhereMatches(row, stmt.where))
  if (rows.length === 0 && (opts?.seedRows?.length ?? 0) > 0) {
    await ensureAppSqlSeed(scope, stmt.table, opts!.seedRows!, pkField)
    rows = (await listAppSqlRows(scope, stmt.table)).filter((row) => sqlWhereMatches(row, stmt.where))
  }
  const updated: sql_row[] = []
  for (const row of rows) {
    const next = { ...row }
    for (const assignment of stmt.set) next[assignment.field] = evalSqlExpr(assignment.expr, next)
    updated.push(await upsertAppSqlRow(scope, stmt.table, next, pkField))
  }
  return stmt.returning ? updated : updated
}
