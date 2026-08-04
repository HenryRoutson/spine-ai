import type { DocRef, ModelOptionPublic, PipelineRun, Project } from "@/lib/types"

// AI : per-project /api/state responses — kept in memory for instant project switches.
export type CachedServerState = {
  projects: Project[]
  docs: DocRef[]
  runs: PipelineRun[]
  allRuns: PipelineRun[]
  modelOptions: ModelOptionPublic[]
}

type ProjectStateCacheEntry = {
  data: CachedServerState
  fetchedAt: number
  bytes: number
}

const projectStateById = new Map<string, ProjectStateCacheEntry>()
const cacheListeners = new Set<() => void>()
let cacheRevision = 0

function notifyCacheListeners(): void {
  cacheRevision += 1
  for (const listener of cacheListeners) listener()
}

export function getProjectStateCacheRevision(): number {
  return cacheRevision
}

export function subscribeProjectStateCache(listener: () => void): () => void {
  cacheListeners.add(listener)
  return () => cacheListeners.delete(listener)
}

export function estimateJsonBytes(data: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(data)).length
  } catch {
    return 0
  }
}

export function formatDataBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export type ProjectStateCacheStat = {
  projectId: string
  bytes: number
  fetchedAt: number
  docCount: number
  runCount: number
}

export function getProjectStateCacheStats(): ProjectStateCacheStat[] {
  return [...projectStateById.entries()].map(([projectId, entry]) => ({
    projectId,
    bytes: entry.bytes,
    fetchedAt: entry.fetchedAt,
    docCount: entry.data.docs.length,
    runCount: entry.data.runs.length,
  }))
}

export function getProjectStateCacheTotalBytes(): number {
  let total = 0
  for (const entry of projectStateById.values()) total += entry.bytes
  return total
}

export function readProjectStateCache(projectId: string): CachedServerState | null {
  if (!projectId) return null
  return projectStateById.get(projectId)?.data ?? null
}

export function writeProjectStateCache(projectId: string, data: CachedServerState): void {
  if (!projectId) return
  projectStateById.set(projectId, {
    data,
    fetchedAt: Date.now(),
    bytes: estimateJsonBytes(data),
  })
  notifyCacheListeners()
}

export function clearProjectStateCache(projectId: string): void {
  if (!projectId) return
  projectStateById.delete(projectId)
  notifyCacheListeners()
}


export function warmProjectPrefetches(
  projectIds: readonly string[],
  prefetch: (projectId: string) => void,
): void {
  for (const projectId of projectIds) prefetch(projectId)
}
