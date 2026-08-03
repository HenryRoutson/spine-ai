import { appStorageKey } from "@/lib/storage-keys"

export type SettingsAccountSnapshot = {
  email: string | null
  marketingOptIn: boolean
}

const KEY = appStorageKey("settings-account-snapshot")

let memorySnapshot: SettingsAccountSnapshot | null = null

function isSettingsAccountSnapshot(v: unknown): v is SettingsAccountSnapshot {
  if (!v || typeof v !== "object") return false
  const o = v as SettingsAccountSnapshot
  return (
    (o.email === null || typeof o.email === "string") &&
    typeof o.marketingOptIn === "boolean"
  )
}

export function readSettingsAccountSnapshot(): SettingsAccountSnapshot | null {
  if (memorySnapshot) return memorySnapshot
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isSettingsAccountSnapshot(parsed)) return null
    memorySnapshot = parsed
    return parsed
  } catch {
    return null
  }
}

export function writeSettingsAccountSnapshot(account: SettingsAccountSnapshot): void {
  memorySnapshot = account
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(KEY, JSON.stringify(account))
  } catch {
    /* quota — memory cache still helps tab revisits */
  }
}

export function clearSettingsAccountSnapshot(): void {
  memorySnapshot = null
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
