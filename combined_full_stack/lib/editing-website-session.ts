import { appStorageKey } from "@/lib/storage-keys"
import { isSiteLinkId } from "@/lib/hosted-site"
import type { SharedLinkRecord } from "@/lib/shared-link-types"

const KEY = appStorageKey("editing-website")

// AI : opening a website must survive /?list=* → / navigation remounts of AppShellProvider.
export function readEditingWebsiteSession(): SharedLinkRecord | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SharedLinkRecord
    if (!parsed?.id || !isSiteLinkId(parsed.id)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeEditingWebsiteSession(link: SharedLinkRecord): void {
  sessionStorage.setItem(KEY, JSON.stringify(link))
}

export function clearEditingWebsiteSession(): void {
  sessionStorage.removeItem(KEY)
}
