import { appStorageKey } from "@/lib/storage-keys"
import type { TeamView } from "@/lib/team-types"

const KEY = appStorageKey("teams-snapshot")

let memorySnapshot: TeamView[] | null = null

function isTeamView(v: unknown): v is TeamView {
  if (!v || typeof v !== "object") return false
  const o = v as TeamView
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.slug === "string" &&
    typeof o.billingOwnerId === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.role === "string" &&
    Array.isArray(o.members) &&
    Array.isArray(o.pendingInvites)
  )
}

export function readTeamsSnapshot(): TeamView[] | null {
  if (memorySnapshot) return memorySnapshot
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isTeamView)) return null
    memorySnapshot = parsed
    return parsed
  } catch {
    return null
  }
}

export function writeTeamsSnapshot(teams: TeamView[]): void {
  memorySnapshot = teams
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(KEY, JSON.stringify(teams))
  } catch {
    /* quota — memory cache still helps tab revisits */
  }
}

export function clearTeamsSnapshot(): void {
  memorySnapshot = null
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
