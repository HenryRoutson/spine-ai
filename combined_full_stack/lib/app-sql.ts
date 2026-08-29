// AI : hosted Collatz animation parser only — sql steps execute SQLite (JOIN, binds) in app_sqlite.ts.

import { sqlTableName } from "@/lib/sql-id-types"
import type { StructureModel } from "@/lib/types"

export type app_sql_table_name = string & { __brand: "app_sql_table_name" }
export type app_sql_scope = string & { __brand: "app_sql_scope" }
export type app_sql_row_id = string & { __brand: "app_sql_row_id" }

export type SqlLit = string | number | boolean | null

export type sql_binary_op = "*" | "/" | "+" | "-" | "%"

export type SqlExpr =
  | { kind: "lit"; value: SqlLit }
  | { kind: "col"; name: string }
  | { kind: "binary"; op: sql_binary_op; left: SqlExpr; right: SqlExpr }

export type SqlWhere = { field: string; value: SqlLit }

export type ParsedAppSql =
  | { kind: "select"; table: string; columns: "*" | string[]; where?: SqlWhere }
  | {
      kind: "update"
      table: string
      set: { field: string; expr: SqlExpr }[]
      where?: SqlWhere
      returning: boolean
    }
  | { kind: "insert"; table: string; columns: string[]; values: SqlLit[] }

export const APP_SQL_CHANGED_EVENT = "spine-app-sql-changed"

export function appSqlScopeForSite(siteId: string): app_sql_scope {
  return `site:${siteId}` as app_sql_scope
}

export function appSqlScopeForProject(projectId: string): app_sql_scope {
  return `project:${projectId}` as app_sql_scope
}

export function tableNameForModel(model: Pick<StructureModel, "name">): app_sql_table_name {
  return sqlTableName(model.name) as app_sql_table_name
}

type Tok =
  | { kind: "ident"; value: string }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "punct"; value: string }

const KEYWORDS = new Set([
  "select",
  "update",
  "insert",
  "into",
  "from",
  "set",
  "where",
  "returning",
  "values",
  "and",
  "true",
  "false",
  "null",
])

function tokenize(sql: string): Tok[] {
  const src = sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ").trim().replace(/;+\s*$/, "")
  const tokens: Tok[] = []
  let i = 0
  const ident = (start: number): string => {
    let j = start
    while (j < src.length && /[A-Za-z0-9_]/.test(src[j]!)) j += 1
    return src.slice(start, j)
  }
  while (i < src.length) {
    const ch = src[i]!
    if (/\s/.test(ch)) {
      i += 1
      continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      const raw = ident(i)
      i += raw.length
      const lower = raw.toLowerCase()
      if (lower === "true" || lower === "false" || lower === "null" || KEYWORDS.has(lower)) {
        tokens.push({ kind: "ident", value: lower })
      } else {
        tokens.push({ kind: "ident", value: raw })
      }
      continue
    }
    if (ch === "'" ) {
      i += 1
      let out = ""
      while (i < src.length) {
        const c = src[i]!
        if (c === "'" && src[i + 1] === "'") {
          out += "'"
          i += 2
          continue
        }
        if (c === "'") {
          i += 1
          break
        }
        out += c
        i += 1
      }
      tokens.push({ kind: "string", value: out })
      continue
    }
    if (ch === "-" && /[0-9]/.test(src[i + 1] ?? "")) {
      const m = /^-?\d+(?:\.\d+)?/.exec(src.slice(i))
      if (!m) throw new Error("could not parse number")
      tokens.push({ kind: "number", value: Number(m[0]) })
      i += m[0].length
      continue
    }
    if (/[0-9]/.test(ch)) {
      const m = /^\d+(?:\.\d+)?/.exec(src.slice(i))
      if (!m) throw new Error("could not parse number")
      tokens.push({ kind: "number", value: Number(m[0]) })
      i += m[0].length
      continue
    }
    if ("=*,/+-%(),".includes(ch)) {
      tokens.push({ kind: "punct", value: ch })
      i += 1
      continue
    }
    throw new Error(`unexpected character in SQL: ${JSON.stringify(ch)}`)
  }
  return tokens
}

class Parser {
  constructor(private readonly tokens: Tok[], private i = 0) {}

  peek(): Tok | undefined {
    return this.tokens[this.i]
  }

  take(): Tok {
    const t = this.tokens[this.i]
    if (!t) throw new Error("unexpected end of SQL")
    this.i += 1
    return t
  }

  identKeyword(word: string): boolean {
    const t = this.peek()
    return t?.kind === "ident" && t.value === word
  }

  eatKeyword(word: string): void {
    const t = this.take()
    if (t.kind !== "ident" || t.value !== word) throw new Error(`expected ${word.toUpperCase()}`)
  }

  eatPunct(ch: string): void {
    const t = this.take()
    if (t.kind !== "punct" || t.value !== ch) throw new Error(`expected ${ch}`)
  }

  eatIdent(): string {
    const t = this.take()
    if (t.kind !== "ident" || KEYWORDS.has(t.value)) throw new Error("expected table or column name")
    return t.value
  }

  eatLit(): SqlLit {
    const t = this.take()
    if (t.kind === "string") return t.value
    if (t.kind === "number") return t.value
    if (t.kind === "ident" && t.value === "true") return true
    if (t.kind === "ident" && t.value === "false") return false
    if (t.kind === "ident" && t.value === "null") return null
    throw new Error("expected literal")
  }

  parseWhere(): SqlWhere | undefined {
    if (!this.identKeyword("where")) return undefined
    this.eatKeyword("where")
    const field = this.eatIdent()
    this.eatPunct("=")
    const value = this.eatLit()
    if (this.identKeyword("and")) throw new Error("AND in WHERE is not supported in this slice")
    return { field, value }
  }

  parseExpr(): SqlExpr {
    return this.parseAdd()
  }

  private parseAdd(): SqlExpr {
    let left = this.parseMul()
    while (this.peek()?.kind === "punct" && (this.peek()!.value === "+" || this.peek()!.value === "-")) {
      const op = this.take().value as "+" | "-"
      left = { kind: "binary", op, left, right: this.parseMul() }
    }
    return left
  }

  private parseMul(): SqlExpr {
    let left = this.parseFactor()
    while (
      this.peek()?.kind === "punct" &&
      (this.peek()!.value === "*" || this.peek()!.value === "/" || this.peek()!.value === "%")
    ) {
      const op = this.take().value as "*" | "/" | "%"
      left = { kind: "binary", op, left, right: this.parseFactor() }
    }
    return left
  }

  private parseFactor(): SqlExpr {
    const t = this.peek()
    if (!t) throw new Error("expected expression")
    if (t.kind === "punct" && t.value === "(") {
      this.take()
      const inner = this.parseExpr()
      this.eatPunct(")")
      return inner
    }
    if (t.kind === "ident" && !KEYWORDS.has(t.value)) {
      return { kind: "col", name: this.eatIdent() }
    }
    return { kind: "lit", value: this.eatLit() }
  }

  parse(): ParsedAppSql {
    if (this.identKeyword("select")) return this.parseSelect()
    if (this.identKeyword("update")) return this.parseUpdate()
    if (this.identKeyword("insert")) return this.parseInsert()
    throw new Error("SQL must be SELECT, UPDATE, or INSERT")
  }

  private parseSelect(): ParsedAppSql {
    this.eatKeyword("select")
    let columns: "*" | string[]
    if (this.peek()?.kind === "punct" && this.peek()?.value === "*") {
      this.take()
      columns = "*"
    } else {
      columns = [this.eatIdent()]
      while (this.peek()?.kind === "punct" && this.peek()?.value === ",") {
        this.take()
        columns.push(this.eatIdent())
      }
    }
    this.eatKeyword("from")
    const table = this.eatIdent()
    const where = this.parseWhere()
    if (this.peek()) throw new Error("unexpected tokens after SELECT")
    return { kind: "select", table, columns, where }
  }

  private parseUpdate(): ParsedAppSql {
    this.eatKeyword("update")
    const table = this.eatIdent()
    this.eatKeyword("set")
    const set: { field: string; expr: SqlExpr }[] = [{ field: this.eatIdent(), expr: (this.eatPunct("="), this.parseExpr()) }]
    while (this.peek()?.kind === "punct" && this.peek()?.value === ",") {
      this.take()
      const field = this.eatIdent()
      this.eatPunct("=")
      set.push({ field, expr: this.parseExpr() })
    }
    const where = this.parseWhere()
    let returning = false
    if (this.identKeyword("returning")) {
      this.eatKeyword("returning")
      if (this.peek()?.kind === "punct" && this.peek()?.value === "*") this.take()
      else this.eatIdent()
      returning = true
    }
    if (this.peek()) throw new Error("unexpected tokens after UPDATE")
    return { kind: "update", table, set, where, returning }
  }

  private parseInsert(): ParsedAppSql {
    this.eatKeyword("insert")
    this.eatKeyword("into")
    const table = this.eatIdent()
    this.eatPunct("(")
    const columns = [this.eatIdent()]
    while (this.peek()?.kind === "punct" && this.peek()?.value === ",") {
      this.take()
      columns.push(this.eatIdent())
    }
    this.eatPunct(")")
    this.eatKeyword("values")
    this.eatPunct("(")
    const values = [this.eatLit()]
    while (this.peek()?.kind === "punct" && this.peek()?.value === ",") {
      this.take()
      values.push(this.eatLit())
    }
    this.eatPunct(")")
    if (this.peek()) throw new Error("unexpected tokens after INSERT")
    if (columns.length !== values.length) throw new Error("INSERT column/value count mismatch")
    return { kind: "insert", table, columns, values }
  }
}

export function parseAppSql(sql: string): ParsedAppSql {
  const trimmed = sql.trim()
  if (!trimmed) throw new Error("SQL is empty")
  return new Parser(tokenize(trimmed)).parse()
}

function asNumber(value: unknown, col: string): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value)
  throw new Error(`column ${col} is not a number`)
}

export function evalSqlExpr(expr: SqlExpr, row: Record<string, unknown>): unknown {
  if (expr.kind === "lit") return expr.value
  if (expr.kind === "col") return row[expr.name]
  const left = asNumber(evalSqlExpr(expr.left, row), "left")
  const right = asNumber(evalSqlExpr(expr.right, row), "right")
  if (expr.op === "+") return left + right
  if (expr.op === "-") return left - right
  if (expr.op === "*") return left * right
  if (right === 0) throw new Error(expr.op === "%" ? "modulo by zero" : "division by zero")
  if (expr.op === "%") return left % right
  return left / right
}

export function sqlWhereMatches(row: Record<string, unknown>, where?: SqlWhere): boolean {
  if (!where) return true
  const got = row[where.field]
  if (typeof where.value === "number" || typeof got === "number") {
    return Number(got) === Number(where.value)
  }
  return String(got ?? "") === String(where.value ?? "")
}

export function projectSqlColumns(
  row: Record<string, unknown>,
  columns: "*" | string[],
): Record<string, unknown> {
  if (columns === "*") return { ...row }
  const out: Record<string, unknown> = {}
  for (const col of columns) {
    if (col in row) out[col] = row[col]
  }
  return out
}

export function rowIdOf(row: Record<string, unknown>, pkField = "id"): app_sql_row_id {
  const raw = row[pkField]
  if (raw == null || String(raw).trim() === "") throw new Error(`row is missing ${pkField}`)
  return String(raw) as app_sql_row_id
}

export function sqlSeedRowsOf(m: { sqlSeedRows?: unknown }): Record<string, unknown>[] {
  if (!Array.isArray(m.sqlSeedRows)) return []
  return m.sqlSeedRows.filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row))
}
