"use client"

import { useCallback, useEffect, useState } from "react"
import { APP_SQL_CHANGED_EVENT } from "@/lib/app-sql"
import { API_ROUTES } from "@/lib/api-routes"
import { FETCH_NO_STORE, parseFetchJson } from "@/lib/api-client"

export type sql_row = Record<string, unknown>

export function useHostedSqlRows(linkId: string, table: string): { rows: sql_row[] | null; error: string | null } {
  const [rows, setRows] = useState<sql_row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_ROUTES.sharedLinkSql(linkId)}?table=${encodeURIComponent(table)}`, FETCH_NO_STORE)
      const body = await parseFetchJson<{ rows?: sql_row[]; error?: string }>(res, "load app sql")
      setRows(body.rows ?? [])
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [linkId, table])

  useEffect(() => {
    void load()
    const onChange = () => {
      void load()
    }
    window.addEventListener(APP_SQL_CHANGED_EVENT, onChange)
    const tick = window.setInterval(() => {
      void load()
    }, 250)
    return () => {
      window.removeEventListener(APP_SQL_CHANGED_EVENT, onChange)
      window.clearInterval(tick)
    }
  }, [load])

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
          <p className="hs-sql-caption">Shared SQL row · {table}</p>
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
      <div className="hs-sql-value">1</div>
      <p className="hs-sql-caption">Shared SQL row · {table} (preview)</p>
    </div>
  )
}
