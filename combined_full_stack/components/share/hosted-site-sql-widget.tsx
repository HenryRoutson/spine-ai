"use client"

import { useEffect, useState } from "react"
import { subscribeHostedSql, type sql_row } from "@/lib/hosted-sql-channel"

export type { sql_row }

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

  const value = rows?.[0]?.value
  const showBig = rows?.length === 1 && (typeof value === "number" || typeof value === "string")

  return (
    <div className="hs-sql-widget" data-spine-id="site.sql-table">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : rows == null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : showBig ? (
        <>
          <div className="hs-sql-value">{String(value)}</div>
          <p className="hs-sql-caption">SQL · {table}</p>
        </>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rows in {table}</p>
      ) : (
        <pre className="overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-left text-xs">
          {JSON.stringify(rows, null, 2)}
        </pre>
      )}
    </div>
  )
}

export function HostedSiteSqlPreview({ table }: { table: string }) {
  return (
    <div className="hs-sql-widget" data-spine-id="site.sql-table">
      <p className="text-sm text-muted-foreground">No rows in {table}</p>
    </div>
  )
}
