import { APP_SQL_CHANGED_EVENT } from "@/lib/app-sql"
import { API_ROUTES } from "@/lib/api-routes"
import { FETCH_NO_STORE, parseFetchJson } from "@/lib/api-client"

export type sql_row = Record<string, unknown>

type hosted_sql_listener = (rows: sql_row[] | null, error: string | null) => void

type hosted_sql_channel = {
  linkId: string
  table: string
  listeners: Set<hosted_sql_listener>
  rows: sql_row[] | null
  error: string | null
  inflight: boolean
  pending: boolean
  holdPainted: boolean
  interval: number
  onChange: () => void
}

const CHANNELS = new Map<string, hosted_sql_channel>()

function channelKey(linkId: string, table: string): string {
  return `${linkId}::${table}`
}

export function paintHostedSqlValue(linkId: string, table: string, value: number): void {
  const ch = CHANNELS.get(channelKey(linkId, table))
  if (!ch) return
  // AI : show the JSON SQL step's result immediately; fetch confirms from app_sql_rows.
  const base = ch.rows?.[0] ?? { id: "global" }
  ch.holdPainted = true
  ch.rows = [{ ...base, value }]
  for (const listener of ch.listeners) listener(ch.rows, ch.error)
}

export function releaseHostedSqlPaint(linkId: string, table: string): void {
  const ch = CHANNELS.get(channelKey(linkId, table))
  if (!ch) return
  ch.holdPainted = false
  void fetchChannel(ch)
}

async function fetchChannel(ch: hosted_sql_channel): Promise<void> {
  if (ch.holdPainted) return
  if (ch.inflight) {
    ch.pending = true
    return
  }
  ch.inflight = true
  try {
    do {
      ch.pending = false
      try {
        const res = await fetch(
          `${API_ROUTES.sharedLinkSql(ch.linkId)}?table=${encodeURIComponent(ch.table)}`,
          FETCH_NO_STORE,
        )
        const body = await parseFetchJson<{ rows?: sql_row[]; error?: string }>(res, "load app sql")
        ch.rows = body.rows ?? []
        ch.error = null
      } catch (err) {
        ch.error = (err as Error).message
      }
      for (const listener of ch.listeners) listener(ch.rows, ch.error)
    } while (ch.pending)
  } finally {
    ch.inflight = false
  }
}

export function subscribeHostedSql(
  linkId: string,
  table: string,
  listener: hosted_sql_listener,
): () => void {
  const key = channelKey(linkId, table)
  const existing = CHANNELS.get(key)
  if (existing) {
    existing.listeners.add(listener)
    listener(existing.rows, existing.error)
    return () => {
      existing.listeners.delete(listener)
      if (existing.listeners.size > 0) return
      window.clearInterval(existing.interval)
      window.removeEventListener(APP_SQL_CHANGED_EVENT, existing.onChange)
      CHANNELS.delete(key)
    }
  }
  const ch: hosted_sql_channel = {
    linkId,
    table,
    listeners: new Set(),
    rows: null,
    error: null,
    inflight: false,
    pending: false,
    holdPainted: false,
    interval: 0,
    onChange: () => undefined,
  }
  ch.onChange = () => {
    void fetchChannel(ch)
  }
  CHANNELS.set(key, ch)
  // AI : one poller per table — three widgets must not triple the SQL GET.
  ch.interval = window.setInterval(ch.onChange, 1400)
  window.addEventListener(APP_SQL_CHANGED_EVENT, ch.onChange)
  void fetchChannel(ch)
  ch.listeners.add(listener)
  listener(ch.rows, ch.error)
  return () => {
    ch.listeners.delete(listener)
    if (ch.listeners.size > 0) return
    window.clearInterval(ch.interval)
    window.removeEventListener(APP_SQL_CHANGED_EVENT, ch.onChange)
    CHANNELS.delete(key)
  }
}
