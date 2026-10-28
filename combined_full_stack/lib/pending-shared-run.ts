import { appStorageKey } from "@/lib/storage-keys"
import type { shared_link_id_string } from "@/lib/shared-with-me"

const KEY = appStorageKey("pending-shared-run")

export function queuePendingSharedRun(linkId: shared_link_id_string): void {
  sessionStorage.setItem(KEY, linkId)
}

export function consumePendingSharedRun(): shared_link_id_string | null {
  try {
    const v = sessionStorage.getItem(KEY)?.trim()
    if (v) sessionStorage.removeItem(KEY)
    return v ?? null
  } catch {
    return null
  }
}
