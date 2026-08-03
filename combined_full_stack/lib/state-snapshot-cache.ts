import { appStorageKey } from "@/lib/storage-keys"
import type { DocRef, ModelOptionPublic, PipelineRun, Project } from "@/lib/types"

const KEY = appStorageKey("state-snapshot")

export type CachedServerState = {
  projects: Project[]
  docs: DocRef[]
  runs: PipelineRun[]
  allRuns: PipelineRun[]
  modelOptions: ModelOptionPublic[]
}

// AI : survives client navigations within the tab; sessionStorage survives full reloads.
let memorySnapshot: CachedServerState | null = null

function isCachedServerState(v: unknown): v is CachedServerState {
  if (!v || typeof v !== "object") return false
  const o = v as CachedServerState
  return Array.isArray(o.projects) && Array.isArray(o.docs) && Array.isArray(o.modelOptions)
}

export function readStateSnapshot(): CachedServerState | null {
  if (memorySnapshot) return memorySnapshot
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isCachedServerState(parsed)) return null
    memorySnapshot = parsed
    return parsed
  } catch {
    return null
  }
}

export function writeStateSnapshot(state: CachedServerState): void {
  memorySnapshot = state
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* quota — memory cache still helps client navigations */
  }
}

export function clearStateSnapshot(): void {
  memorySnapshot = null
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
