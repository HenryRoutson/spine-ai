// AI : Postgres engine for sql steps — same dialect as derived/schema.sql and hosted Supabase.
import { createHash } from "node:crypto"
import { PGlite } from "@electric-sql/pglite"
import pg from "pg"
import { uid } from "@/lib/id"
import { sqlCellText } from "@/lib/schema-table-fn"
import { sqlIdent } from "@/lib/sql-id-types"

type sql_row = Record<string, unknown>
type sql_engine_kind = "pglite" | "pg"

type SqlClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: sql_row[] }>
}

const { Pool } = pg
type PoolClient = pg.PoolClient

const pgliteByKey = new Map<string, PGlite>()
let pgliteChain: Promise<unknown> = Promise.resolve()
let pool: pg.Pool | null = null
let poolFailed = false
let forcePglite = !!process.env.VITEST
let pgliteEpoch = 0
let lastEngine: sql_engine_kind = "pglite"

export function appSqlEngineKind(): sql_engine_kind {
  return lastEngine
}

export function resetAppPostgresForTests(): void {
  forcePglite = true
  poolFailed = false
  pgliteEpoch += 1
}

export async function resetAppPostgresForTestsAsync(): Promise<void> {
  forcePglite = true
  poolFailed = false
  pgliteEpoch += 1
  await closePgliteCaches()
}

export function preferLivePostgres(): void {
  forcePglite = false
}

async function closePgliteCaches(): Promise<void> {
  const dbs = [...pgliteByKey.values()]
  pgliteByKey.clear()
  await Promise.all(
    dbs.map(async (db) => {
      try {
        await db.close()
      } catch {
        // AI : already closed
      }
    }),
  )
}

function resolvePostgresUrl(): string | null {
  const keys = ["DATABASE_URL", "SUPABASE_DB_URL", "POSTGRES_URL", "SPINE_POSTGRES_URL"]
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value && !value.toLowerCase().includes("placeholder")) return value
  }
  if (process.env.NODE_ENV !== "production") {
    return "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  }
  return null
}

async function getPool(): Promise<pg.Pool | null> {
  if (forcePglite || poolFailed) return null
  if (pool) return pool
  const url = resolvePostgresUrl()
  if (!url) return null
  try {
    const next = new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 2_000 })
    const probe = await next.connect()
    probe.release()
    pool = next
    return next
  } catch {
    poolFailed = true
    return null
  }
}

export function schemaNameForScope(scope: string): string {
  const key = forcePglite ? `${pgliteEpoch}:${scope}` : scope
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16)
  return `a_${hash}`
}

function quoteIdent(name: string): string {
  const ident = sqlIdent(name) || name.replace(/[^A-Za-z0-9_]/g, "_")
  return `"${ident.replace(/"/g, '""')}"`
}

function withPgliteExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = pgliteChain.then(fn, fn)
  pgliteChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function pgliteFor(key: string): Promise<PGlite> {
  const hit = pgliteByKey.get(key)
  if (hit) return hit
  const db = new PGlite()
  await db.waitReady
  pgliteByKey.set(key, db)
  return db
}

function pgliteClient(db: PGlite): SqlClient {
  return {
    query: async (text, params) => {
      const result = await db.query<sql_row>(text, params ?? [])
      return { rows: result.rows as sql_row[] }
    },
  }
}

function pgClient(client: PoolClient): SqlClient {
  return {
    query: async (text, params) => {
      const result = await client.query(text, params ?? [])
      return { rows: result.rows as sql_row[] }
    },
  }
}

async function withScopeClient<T>(scope: string, fn: (client: SqlClient) => Promise<T>): Promise<T> {
  const schema = schemaNameForScope(scope)
  const live = await getPool()
  if (live) {
    lastEngine = "pg"
    const client = await live.connect()
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`)
      await client.query(`SET search_path TO ${quoteIdent(schema)}`)
      return await fn(pgClient(client))
    } finally {
      try {
        await client.query("SET search_path TO public")
      } catch {
        // AI : connection may already be broken
      }
      client.release()
    }
  }
  lastEngine = "pglite"
  return withPgliteExclusive(async () => {
    const db = await pgliteFor("shared")
    await db.exec(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}; SET search_path TO ${quoteIdent(schema)}`)
    return fn(pgliteClient(db))
  })
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

export function runtimeSchemaSql(schemaSql: string): string {
  return schemaSql
    .replace(/\bBLOB\b/gi, "BYTEA")
    .replace(/\s+REFERENCES\s+[A-Za-z_][\w.]*\s*\([^)]*\)/gi, "")
    .replace(/\s+ON\s+DELETE\s+(CASCADE|RESTRICT|SET\s+NULL|NO\s+ACTION)/gi, "")
    .replace(/\s+ON\s+UPDATE\s+(CASCADE|RESTRICT|SET\s+NULL|NO\s+ACTION)/gi, "")
    .replace(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi, "CREATE TABLE IF NOT EXISTS ")
    .replace(/CREATE\s+OR\s+REPLACE\s+VIEW\s+IF\s+NOT\s+EXISTS/gi, "CREATE OR REPLACE VIEW ")
    .replace(/CREATE\s+VIEW\s+IF\s+NOT\s+EXISTS/gi, "CREATE OR REPLACE VIEW ")
    .replace(/CREATE\s+VIEW\s+(?!OR\s+REPLACE)/gi, "CREATE OR REPLACE VIEW ")
}

export async function applySchemaSql(client: SqlClient, schemaSql: string): Promise<void> {
  for (const stmt of splitSqlStatements(runtimeSchemaSql(schemaSql))) {
    if (!stmt || /^--/.test(stmt)) continue
    try {
      await client.query(stmt)
    } catch {
      // AI : leftover annotation DDL must not block user SQL
    }
  }
}

function affinity(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return Number.isInteger(value) ? "INTEGER" : "DOUBLE PRECISION"
  if (typeof value === "boolean") return "INTEGER"
  return "TEXT"
}

export function ensureTableFromRowsSql(table: string, rows: sql_row[], pkField = "id"): string | null {
  const sample = rows.find((r) => r && typeof r === "object")
  if (!sample) return null
  const cols = Object.keys(sample).filter((k) => k.trim())
  if (!cols.length) return null
  const names = cols.includes(pkField) ? cols : [pkField, ...cols]
  const body = names
    .map((c) => {
      const pk = c === pkField ? " PRIMARY KEY" : ""
      return `${quoteIdent(c)} ${affinity(sample[c])}${pk}`
    })
    .join(", ")
  return `CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} (${body})`
}

async function tableExists(client: SqlClient, table: string): Promise<boolean> {
  const row = await client.query("SELECT to_regclass($1) AS reg", [table])
  return row.rows[0]?.reg != null
}

function extractInsert(sql: string): { table: string; columns: string[] } | null {
  const m = /^\s*INSERT\s+(?:OR\s+\w+\s+)?INTO\s+"?([A-Za-z_][\w]*)"?\s*\(([^)]+)\)\s*VALUES\s*\(/i.exec(sql)
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
  if (/\?/.test(sql)) return true
  if (/\$\d+/.test(sql)) return true
  return /(?<!:)[:@$][A-Za-z_]/.test(sql)
}

export function toPostgresPlaceholders(sql: string): string {
  const named = /(?<!:)[:@$]([A-Za-z_][\w]*)/g
  const hasNamed = named.test(sql)
  named.lastIndex = 0
  if (!hasNamed && !sql.includes("?")) return sql
  let i = 0
  return sql.replace(named, () => `$${++i}`).replace(/\?/g, () => `$${++i}`)
}

export function bindSqlForRow(sql: string, row: sql_row): { sql: string; params: unknown[] } {
  const insert = extractInsert(sql)
  const alreadyDollar = /\$\d+/.test(sql) && !/\?/.test(sql) && !/(?<!:)[:@$][A-Za-z_]/.test(sql)
  if (alreadyDollar) {
    const max = Math.max(0, ...[...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])))
    const cols = insert?.columns ?? Object.keys(row)
    return {
      sql,
      params: Array.from({ length: max }, (_, i) => {
        const col = cols[i]
        return col ? sqlBindCell(row, col) : null
      }),
    }
  }
  const params: unknown[] = []
  let next = sql.replace(/(?<!:)[:@$]([A-Za-z_][\w]*)/g, (_all, name: string) => {
    params.push(sqlBindCell(row, name))
    return "?"
  })
  if (params.length) {
    let i = 0
    return { sql: next.replace(/\?/g, () => `$${++i}`), params }
  }
  const qmarks = (next.match(/\?/g) ?? []).length
  if (!qmarks) return { sql: toPostgresPlaceholders(next), params: [] }
  const keys = insert?.columns ?? Object.keys(row)
  let i = 0
  return {
    sql: next.replace(/\?/g, () => `$${++i}`),
    params: keys.slice(0, qmarks).map((c) => sqlBindCell(row, c)),
  }
}

function rewriteSqliteIdioms(sql: string): string {
  return sql
    .replace(/\bINSERT\s+OR\s+REPLACE\s+INTO\b/gi, "INSERT INTO")
    .replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, "INSERT INTO")
    .replace(/\bAUTOINCREMENT\b/gi, "")
}

function withReturning(sql: string): string {
  const t = rewriteSqliteIdioms(sql).trim().replace(/;+\s*$/, "")
  if (!/^\s*(INSERT|UPDATE|DELETE)\b/i.test(t)) return t
  if (/\bRETURNING\b/i.test(t)) return t
  return `${t} RETURNING *`
}

function isSelectLike(sql: string): boolean {
  return /^\s*(SELECT|WITH|EXPLAIN)\b/i.test(sql) || /\bRETURNING\b/i.test(sql)
}

function isDdl(sql: string): boolean {
  return /^\s*(CREATE|DROP|ALTER|VACUUM|REINDEX|ANALYZE|TRUNCATE)\b/i.test(sql)
}

function cellPlain(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value)
  if (value instanceof Date) return value.toISOString()
  return value
}

function rowPlain(row: unknown): sql_row {
  const src = row as sql_row
  const out: sql_row = {}
  for (const [k, v] of Object.entries(src ?? {})) out[k] = cellPlain(v)
  return out
}

function toSqlBind(value: unknown): unknown {
  if (value == null) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value === "string") return value
  if (value instanceof Uint8Array) return value
  return sqlCellText(value)
}

async function runStatement(client: SqlClient, sql: string, params: unknown[]): Promise<sql_row[]> {
  const text = withReturning(sql)
  if (isDdl(text)) {
    await client.query(text)
    return []
  }
  const binds = params.map(toSqlBind)
  const result = await client.query(text, binds)
  if (isSelectLike(text)) return result.rows.map(rowPlain)
  return result.rows.map(rowPlain)
}

async function addMissingColumn(client: SqlClient, table: string, col: string): Promise<boolean> {
  try {
    await client.query(`ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${quoteIdent(col)} TEXT`)
    return true
  } catch {
    return false
  }
}

async function runEvolving(
  client: SqlClient,
  sql: string,
  params: unknown[],
  sample?: sql_row,
  pkField = "id",
): Promise<sql_row[]> {
  let lastErr: unknown
  for (let i = 0; i < 24; i++) {
    try {
      return await runStatement(client, sql, params)
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      const noCol =
        /column "([^"]+)" of relation "([^"]+)" does not exist/i.exec(msg) ??
        /^column "([^"]+)" does not exist/i.exec(msg)
      if (noCol) {
        const col = noCol[1]!
        const table = noCol[2] ?? extractTableName(sql)
        if (table && (await addMissingColumn(client, table, col))) continue
      }
      const noTable = /(?<!of )relation "([^"]+)" does not exist/i.exec(msg)
      if (noTable) {
        const t = noTable[1]!
        const ddl = sample ? ensureTableFromRowsSql(t, [sample], pkField) : `CREATE TABLE IF NOT EXISTS ${quoteIdent(t)} ("id" TEXT)`
        if (ddl) {
          try {
            await client.query(ddl)
          } catch {
            // AI : table may have appeared concurrently
          }
        }
        continue
      }
      throw err
    }
  }
  throw lastErr
}

export type ExecPostgresOpts = {
  seedRows?: sql_row[]
  pkField?: string
  bindRows?: sql_row[]
  schemaSql?: string
}

export async function execPostgres(scope: string, sql: string, opts?: ExecPostgresOpts): Promise<sql_row[]> {
  return withScopeClient(scope, async (client) => {
    if (opts?.schemaSql?.trim()) await applySchemaSql(client, opts.schemaSql)
    const trimmed = sql.trim().replace(/;+\s*$/, "")
    if (!trimmed) return []
    const table = extractTableName(trimmed)
    const seed = opts?.seedRows ?? []
    const pkField = opts?.pkField ?? "id"
    if (table && seed.length) {
      const ddl = ensureTableFromRowsSql(table, seed, pkField)
      if (ddl) {
        try {
          await client.query(ddl)
        } catch {
          // AI : schema.sql already created the table
        }
      }
      if (await tableExists(client, table)) {
        const counted = await client.query(`SELECT COUNT(*)::int AS n FROM ${quoteIdent(table)}`)
        const n = Number(counted.rows[0]?.n ?? 0)
        if (n === 0) {
          for (const row of seed) {
            const cols = Object.keys(row)
            if (!cols.length) continue
            const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ")
            await runEvolving(
              client,
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
        out.push(...(await runEvolving(client, bound.sql, bound.params, row, pkField)))
      }
      return out
    }
    const statements = splitSqlStatements(trimmed)
    let last: sql_row[] = []
    for (const stmt of statements) {
      last = await runEvolving(client, stmt, [], bindRows[0], pkField)
    }
    if (
      !last.length &&
      table &&
      (await tableExists(client, table)) &&
      /^\s*(UPDATE|DELETE)\b/i.test(trimmed) &&
      !/\bRETURNING\b/i.test(trimmed)
    ) {
      const listed = await client.query(`SELECT * FROM ${quoteIdent(table)}`)
      return listed.rows.map(rowPlain)
    }
    return last
  })
}

export async function listPostgresRows(scope: string, table: string): Promise<sql_row[]> {
  return withScopeClient(scope, async (client) => {
    if (!(await tableExists(client, table))) return []
    const listed = await client.query(`SELECT * FROM ${quoteIdent(table)}`)
    return listed.rows.map(rowPlain)
  })
}

export async function upsertPostgresRow(scope: string, table: string, row: sql_row, pkField = "id"): Promise<sql_row> {
  return withScopeClient(scope, async (client) => {
    const ddl = ensureTableFromRowsSql(table, [row], pkField)
    if (ddl) {
      try {
        await client.query(ddl)
      } catch {
        // AI : table already exists
      }
    }
    const cols = Object.keys(row)
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ")
    const assigned = cols.filter((c) => c !== pkField)
    const conflict =
      assigned.length > 0
        ? `ON CONFLICT (${quoteIdent(pkField)}) DO UPDATE SET ${assigned
            .map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
            .join(", ")}`
        : `ON CONFLICT (${quoteIdent(pkField)}) DO NOTHING`
    await runEvolving(
      client,
      `INSERT INTO ${quoteIdent(table)} (${cols.map(quoteIdent).join(", ")}) VALUES (${placeholders}) ${conflict}`,
      cols.map((c) => sqlBindCell(row, c)),
      row,
      pkField,
    )
    return { ...row }
  })
}

export async function preparePostgresSql(sql: string, schemaSql?: string): Promise<string | null> {
  return withPgliteExclusive(async () => {
    const db = await pgliteFor("prepare")
    try {
      await db.exec("DROP SCHEMA IF EXISTS z_prepare CASCADE; CREATE SCHEMA z_prepare; SET search_path TO z_prepare")
      const client = pgliteClient(db)
      if (schemaSql?.trim()) await applySchemaSql(client, schemaSql)
      for (const stmt of splitSqlStatements(sql.trim() || "SELECT 1")) {
        if (!stmt || /^--/.test(stmt)) continue
        const normalized = toPostgresPlaceholders(rewriteSqliteIdioms(stmt))
        if (isDdl(normalized)) {
          try {
            await client.query(normalized)
          } catch (err) {
            return err instanceof Error ? err.message : String(err)
          }
          continue
        }
        try {
          await db.describeQuery(normalized)
        } catch (err) {
          return err instanceof Error ? err.message : String(err)
        }
      }
      return null
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  })
}
