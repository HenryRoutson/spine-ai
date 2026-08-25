import { appStorageKey } from "@/lib/storage-keys"

export type shared_link_id_string = string

export type SharedWithMeEntry = {
  linkId: shared_link_id_string
  name?: string
  addedAt: number
}

const KEY = appStorageKey("shared-with-me")

export function parseSharedLinkIdFromInput(raw: string): shared_link_id_string | null {
  const trimmed = raw.trim()
  const fromUrl =
    trimmed.match(/\/(?:run|embed|site)\/((?:pub|emb|site)_[a-f0-9]+)/i)?.[1]
  if (fromUrl) return fromUrl
  if (/^(?:pub|emb|site)_[a-f0-9]+$/i.test(trimmed)) return trimmed
  return null
}

export function readSharedWithMe(): SharedWithMeEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SharedWithMeEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSharedWithMe(entries: SharedWithMeEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries))
}

export function addSharedWithMe(linkId: shared_link_id_string, name?: string): void {
  const cur = readSharedWithMe().filter((e) => e.linkId !== linkId)
  writeSharedWithMe([{ linkId, name, addedAt: Date.now() }, ...cur])
}

export function removeSharedWithMe(linkId: shared_link_id_string): void {
  writeSharedWithMe(readSharedWithMe().filter((e) => e.linkId !== linkId))
}

export function updateSharedWithMeName(linkId: shared_link_id_string, name: string): void {
  writeSharedWithMe(
    readSharedWithMe().map((e) => (e.linkId === linkId ? { ...e, name } : e)),
  )
}
