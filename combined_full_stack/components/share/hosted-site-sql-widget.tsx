"use client"

import { useEffect, useState } from "react"
import { subscribeHostedSql, type sql_row } from "@/lib/hosted-sql-channel"

export type { sql_row }

const PREFERRED_SQL_COLS = ["id", "name", "number", "value", "count", "odd"]

function looksLikeSharedCounter(rows: sql_row[]): boolean {
  if (rows.length !== 1) return false
  const row = rows[0]!
  return "value" in row && !("name" in row) && (typeof row.value === "number" || typeof row.value === "string")
}

function formatSqlCell(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function sqlTableColumns(rows: sql_row[]): string[] {
  const cols = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  return [...PREFERRED_SQL_COLS.filter((col) => cols.includes(col)), ...cols.filter((col) => !PREFERRED_SQL_COLS.includes(col))]
}

function HostedSiteSqlTable({ rows, table }: { rows: sql_row[]; table: string }) {
  const cols = sqlTableColumns(rows)
  return (
    <div className="hs-sql-table-wrap">
      <table className="hs-sql-table">
        <thead>
          <tr>
            {cols.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)}>
              {cols.map((col) => (
                <td key={col}>{formatSqlCell(row[col])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hs-sql-caption">Shared SQL table · {table} · {rows.length} row{rows.length === 1 ? "" : "s"}</p>
    </div>
  )
}

export function useHostedSqlRows(linkId: string, table: string): { rows: sql_row[] | null; error: string | null } {
  const [rows, setRows] = useState<sql_row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return subscribeHostedSql(linkId, table, (nextRows, nextError) => {
      setRows(nextRows)
      setError(nextError)
    })
  }, [linkId, table])

  return { rows, error }
}

export function HostedSiteSqlWidget({
  linkId,
  table,
}: {
  linkId: string
  table: string
}) {
  const { rows, error } = useHostedSqlRows(linkId, table)
  const showBig = !!rows && looksLikeSharedCounter(rows)
  const value = rows?.[0]?.value

  return (
    <div className="hs-sql-widget" data-spine-id="site.sql-table">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : rows == null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : showBig ? (
        <>
          <div className="hs-sql-value">{String(value)}</div>
          <p className="hs-sql-caption">Shared SQL row · {table}</p>
        </>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rows in {table}</p>
      ) : (
        <HostedSiteSqlTable rows={rows} table={table} />
      )}
    </div>
  )
}

export function HostedSiteSqlPreview({ table }: { table: string }) {
  if (table !== "shared_number") {
    return (
      <div className="hs-sql-widget" data-spine-id="site.sql-table">
        <p className="hs-sql-caption">Shared SQL table · {table} (preview)</p>
      </div>
    )
  }
  return (
    <div className="hs-sql-widget" data-spine-id="site.sql-table">
      <div className="hs-sql-value">1</div>
      <p className="hs-sql-caption">Shared SQL row · {table} (preview)</p>
    </div>
  )
}
