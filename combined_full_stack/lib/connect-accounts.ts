"use client"
// AI : Remember OAuth connection ids so Sends as can be a dropdown (no live Slack user list).

const STORAGE_KEY = "spine.connect.accounts.v1"

type StoredConnectAccount = {
  id: string
  provider: string
}

function readAll(): StoredConnectAccount[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((row): row is StoredConnectAccount => {
      return Boolean(row && typeof row === "object" && typeof (row as StoredConnectAccount).id === "string" && typeof (row as StoredConnectAccount).provider === "string")
    })
  } catch {
    return []
  }
}

function writeAll(rows: StoredConnectAccount[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

export function rememberConnectAccount(provider: string, id: string): void {
  const trimmed = id.trim()
  if (!trimmed || !provider) return
  const rest = readAll().filter((row) => !(row.provider === provider && row.id === trimmed))
  writeAll([{ id: trimmed, provider }, ...rest])
}

export function listRememberedConnectAccounts(provider: string): string[] {
  return readAll().filter((row) => row.provider === provider).map((row) => row.id)
}

export function shortConnectAccountLabel(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}…` : id
}
