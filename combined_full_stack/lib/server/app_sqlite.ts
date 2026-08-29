// AI : SQLite engine for sql steps — vibe can write real SQL (JOIN, aggregations, ? / :name / $1 binds).
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { dataDir } from "./config"
import { uid } from "@/lib/id"
import { sqlCellText } from "@/lib/schema-table-fn"
import { sqlIdent } from "@/lib/sql-id-types"

type sql_row = Record<string, unknown>
type DatabaseSync = import("node:sqlite").DatabaseSync
type StatementSync = import("node:sqlite").StatementSync

const requireSqlite = createRequire(import.meta.url)

function DatabaseSyncCtor(): typeof import("node:sqlite").DatabaseSync {
  return requireSqlite("node:sqlite").DatabaseSync as typeof import("node:sqlite").DatabaseSync
}

const dbs = new Map<string, DatabaseSync>()
let testMode = false

export function resetAppSqliteForTests(): void {
  testMode = true
  for (const db of dbs.values()) {
    try {
      db.close()
    } catch {
      // AI : already closed
    }
  }
  dbs.clear()
}

function fileForScope(scope: string): string {
  const safe = scope.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 180)
  return join(dataDir(), "app_sqlite", `${safe || "scope"}.sqlite`)
}

export function sqliteForScope(scope: string): DatabaseSync {
  const hit = dbs.get(scope)
  if (hit) return hit
  const Ctor = DatabaseSyncCtor()
  if (!testMode) mkdirSync(dirname(fileForScope(scope)), { recursive: true })
  const db = testMode ? new Ctor(":memory:") : new Ctor(fileForScope(scope))
  db.exec("PRAGMA foreign_keys = OFF")
  dbs.set(scope, db)
  return db
}

function splitSqlStatements(sql: string): string[] {
  const out: string[] = []
  let cur = ""
  let inStr = false
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!
    if (inStr) {
      cur += ch
      if (ch === "'" && sql[i + 1] === "'") {
        cur += sql[i + 1]
        i += 1
        continue
      }
      if (ch === "'") inStr = false
      continue
    }
    if (ch === "'") {
      inStr = true
      cur += ch
      continue
    }
    if (ch === ";") {
      const stmt = cur.trim()
      if (stmt) out.push(stmt)
      cur = ""
      continue
    }
    cur += ch
  }
  const tail = cur.trim()
  if (tail) out.push(tail)
  return out
}

export function applySchemaSql(db: DatabaseSync, schemaSql: string): void {
  const prepared = schemaSql
    .replace(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi, "CREATE TABLE IF NOT EXISTS ")
    .replace(/CREATE\s+VIEW\s+(?!IF\s+NOT\s+EXISTS)/gi, "CREATE VIEW IF NOT EXISTS ")
  for (const stmt of splitSqlStatements(prepared)) {
    if (!stmt || /^--/.test(stmt)) continue
    try {
      db.exec(stmt)
    } catch {
      // AI : leftover annotation DDL (empty tables, duplicate views) must not block user SQL.
    }
  }
}

function affinity(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return Number.isInteger(value) ? "INTEGER" : "REAL"
  if (typeof value === "boolean") return "INTEGER"
  return "TEXT"
}

function quoteIdent(name: string): string {
  const ident = sqlIdent(name) || name.replace(/[^A-Za-z0-9_]/g, "_")
  return `"${ident.replace(/"/g, '""')}"`
}

export function ensureTableFromRows(db: DatabaseSync, table: string, rows: sql_row[], pkField = "id"): void {
  const sample = rows.find((r) => r && typeof r === "object")
  if (!sample) return
  const cols = Object.keys(sample).filter((k) => k.trim())
  if (!cols.length) return
  const names = cols.includes(pkField) ? cols : [pkField, ...cols]
  const body = names
    .map((c) => {
      const pk = c === pkField ? " PRIMARY KEY" : ""
      return `${quoteIdent(c)} ${affinity(sample[c])}${pk}`
    })
    .join(", ")
  db.exec(`CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} (${body})`)
}

function tableExists(db: DatabaseSync, table: string): boolean {
  const row = db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type IN ('table','view') AND name = ?").get(table) as
    | { ok?: number }
    | undefined
  return !!row
}

function extractInsert(sql: string): { table: string; columns: string[] } | null {
  const m = /^\s*INSERT\s+INTO\s+"?([A-Za-z_][\w]*)"?\s*\(([^)]+)\)\s*VALUES\s*\(/i.exec(sql)
  if (!m) return null
  return {
    table: m[1]!,
    columns: m[2]!.split(",").map((c) => c.trim().replace(/^["`]|["`]$/g, "")).filter(Boolean),
  }
}

function extractTableName(sql: string): string | null {
  const insert = /^\s*INSERT\s+(?:OR\s+\w+\s+)?INTO\s+"?([A-Za-z_][\w]*)"?/i.exec(sql)
  if (insert) return insert[1]!
  const update = /^\s*UPDATE\s+"?([A-Za-z_][\w]*)"?/i.exec(sql)
  if (update) return update[1]!
  const from = /\bFROM\s+"?([A-Za-z_][\w]*)"?/i.exec(sql)
  return from?.[1] ?? null
}

export function sqlBindCell(row: sql_row, col: string): unknown {
  const key = col in row ? col : Object.keys(row).find((k) => k.toLowerCase() === col.toLowerCase())
  const value = key ? row[key] : undefined
  if (col === "id" && (value == null || String(value).trim() === "")) return `row_${uid()}`
  if (typeof value === "boolean") return value ? 1 : 0
  if (value && typeof value === "object") return sqlCellText(value)
  return value ?? null
}

export function sqlHasPlaceholders(sql: string): boolean {
  return /\?|\$\d+|:[A-Za-z_]|@[A-Za-z_]|\$[A-Za-z_]/.test(sql)
}

export function bindSqlForRow(sql: string, row: sql_row): { sql: string; params: unknown[] } {
  const insert = extractInsert(sql)
  const params: unknown[] = []
  // AI : named binds :vendor @vendor $vendor — leave postgres $1 for the digit pass.
  let next = sql.replace(/[@:$]([A-Za-z_][\w]*)/g, (_all, name: string) => {
    params.push(sqlBindCell(row, name))
    return "?"
  })
  if (/\$\d+/.test(next)) {
    const cols = insert?.columns
    next = next.replace(/\$(\d+)/g, (_all, n: string) => {
      const idx = Number(n) - 1
      const col = cols?.[idx] ?? Object.keys(row)[idx]
      params.push(col ? sqlBindCell(row, col) : null)
      return "?"
    })
    return { sql: next, params }
  }
  if (params.length) return { sql: next, params }
  const qmarks = (next.match(/\?/g) ?? []).length
  if (!qmarks) return { sql: next, params: [] }
  const keys = insert?.columns ?? Object.keys(row)
  return { sql: next, params: keys.slice(0, qmarks).map((c) => sqlBindCell(row, c)) }
}

function isSelectLike(sql: string): boolean {
  return /^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(sql) || /\bRETURNING\b/i.test(sql)
}

function isDdl(sql: string): boolean {
  return /^\s*(CREATE|DROP|ALTER|VACUUM|REINDEX|ANALYZE)\b/i.test(sql)
}

function cellPlain(value: unknown): unknown {
  return typeof value === "bigint" ? Number(value) : value
}

function rowPlain(row: unknown): sql_row {
  const src = row as sql_row
  const out: sql_row = {}
  for (const [k, v] of Object.entries(src ?? {})) out[k] = cellPlain(v)
  return out
}

type sql_bind = null | number | bigint | string | Uint8Array

function toSqlBind(value: unknown): sql_bind {
  if (value == null) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "bigint") return value
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value === "string") return value
  if (value instanceof Uint8Array) return value
  return sqlCellText(value)
}

function runStatement(db: DatabaseSync, sql: string, params: unknown[]): sql_row[] {
  if (isDdl(sql)) {
    db.exec(sql)
    return []
  }
  const stmt: StatementSync = db.prepare(sql)
  const binds = params.map(toSqlBind)
  if (isSelectLike(sql)) {
    const rows = binds.length ? stmt.all(...binds) : stmt.all()
    return (rows as unknown[]).map(rowPlain)
  }
  const info = binds.length ? stmt.run(...binds) : stmt.run()
  if (/^\s*INSERT\b/i.test(sql) && (info.changes ?? 0) > 0) {
    const table = extractTableName(sql)
    if (table && tableExists(db, table)) {
      const row = db.prepare(`SELECT * FROM ${quoteIdent(table)} WHERE rowid = ?`).get(info.lastInsertRowid)
      return row ? [rowPlain(row)] : []
    }
  }
  return []
}

function addMissingColumn(db: DatabaseSync, table: string, col: string): boolean {
  try {
    db.exec(`ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${quoteIdent(col)} TEXT`)
    return true
  } catch {
    return false
  }
}

function runEvolving(db: DatabaseSync, sql: string, params: unknown[], sample?: sql_row, pkField = "id"): sql_row[] {
  let lastErr: unknown
  for (let i = 0; i < 24; i++) {
    try {
      return runStatement(db, sql, params)
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      const noTable = /no such table: "?([A-Za-z_][\w]*)"?/i.exec(msg)
      if (noTable) {
        const t = noTable[1]!
        if (sample) ensureTableFromRows(db, t, [sample], pkField)
        else db.exec(`CREATE TABLE IF NOT EXISTS ${quoteIdent(t)} ("id" TEXT)`)
        continue
      }
      const noCol =
        /has no column named "?([A-Za-z_][\w]*)"?/i.exec(msg) ??
        /no such column: (?:[\w]+\.)?([A-Za-z_][\w]*)/i.exec(msg)
      const table = extractTableName(sql)
      if (noCol && table && addMissingColumn(db, table, noCol[1]!)) continue
      throw err
    }
  }
  throw lastErr
}

export type ExecSqliteOpts = {
  seedRows?: sql_row[]
  pkField?: string
  bindRows?: sql_row[]
  schemaSql?: string
}

export function execSqlite(scope: string, sql: string, opts?: ExecSqliteOpts): sql_row[] {
  const db = sqliteForScope(scope)
  if (opts?.schemaSql?.trim()) applySchemaSql(db, opts.schemaSql)
  const trimmed = sql.trim().replace(/;+\s*$/, "")
  if (!trimmed) return []
  const table = extractTableName(trimmed)
  const seed = opts?.seedRows ?? []
  const pkField = opts?.pkField ?? "id"
  if (table && seed.length) {
    ensureTableFromRows(db, table, seed, pkField)
    if (tableExists(db, table)) {
      const n = (db.prepare(`SELECT COUNT(*) AS n FROM ${quoteIdent(table)}`).get() as { n: number } | undefined)?.n ?? 0
      if (n === 0) {
        for (const row of seed) {
          const cols = Object.keys(row)
          if (!cols.length) continue
          const placeholders = cols.map(() => "?").join(", ")
          runEvolving(
            db,
            `INSERT INTO ${quoteIdent(table)} (${cols.map(quoteIdent).join(", ")}) VALUES (${placeholders})`,
            cols.map((c) => sqlBindCell(row, c)),
            row,
            pkField,
          )
        }
      }
    }
  }
  const bindRows = (opts?.bindRows ?? []).filter((r) => r && typeof r === "object" && !Array.isArray(r))
  if (sqlHasPlaceholders(trimmed) && bindRows.length) {
    const out: sql_row[] = []
    for (const row of bindRows) {
      const bound = bindSqlForRow(trimmed, row)
      out.push(...runEvolving(db, bound.sql, bound.params, row, pkField))
    }
    return out
  }
  const statements = splitSqlStatements(trimmed)
  let last: sql_row[] = []
  for (const stmt of statements) {
    last = runEvolving(db, stmt, [], bindRows[0], pkField)
  }
  if (!last.length && table && tableExists(db, table) && /^\s*(UPDATE|DELETE)\b/i.test(trimmed) && !/\bRETURNING\b/i.test(trimmed)) {
    return (db.prepare(`SELECT * FROM ${quoteIdent(table)}`).all() as unknown[]).map(rowPlain)
  }
  return last
}

export function listSqliteRows(scope: string, table: string): sql_row[] {
  const db = sqliteForScope(scope)
  if (!tableExists(db, table)) return []
  return (db.prepare(`SELECT * FROM ${quoteIdent(table)}`).all() as unknown[]).map(rowPlain)
}

export function upsertSqliteRow(scope: string, table: string, row: sql_row, pkField = "id"): sql_row {
  const db = sqliteForScope(scope)
  ensureTableFromRows(db, table, [row], pkField)
  const cols = Object.keys(row)
  const placeholders = cols.map(() => "?").join(", ")
  runEvolving(
    db,
    `INSERT OR REPLACE INTO ${quoteIdent(table)} (${cols.map(quoteIdent).join(", ")}) VALUES (${placeholders})`,
    cols.map((c) => sqlBindCell(row, c)),
    row,
    pkField,
  )
  return { ...row }
}

export function prepareSqliteSql(sql: string, schemaSql?: string): string | null {
  const Ctor = DatabaseSyncCtor()
  const db = new Ctor(":memory:")
  try {
    if (schemaSql?.trim()) applySchemaSql(db, schemaSql)
    for (const stmt of splitSqlStatements(sql.trim() || "SELECT 1")) {
      if (!stmt || /^--/.test(stmt)) continue
      const normalized = stmt
        .replace(/:[A-Za-z_][\w]*/g, "?")
        .replace(/\$[A-Za-z_][\w]*/g, "?")
        .replace(/\$\d+/g, "?")
        .replace(/@[A-Za-z_][\w]*/g, "?")
      if (isDdl(normalized) || /^\s*PRAGMA\b/i.test(normalized)) {
        try {
          db.exec(normalized)
        } catch (err) {
          return err instanceof Error ? err.message : String(err)
        }
        continue
      }
      db.prepare(normalized)
    }
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  } finally {
    db.close()
  }
}
