import type { DocRef, ModelOptionPublic, PipelineRun, Project } from "@/lib/types"

// AI : account-wide slice — one copy shared across all project switches.
export type AccountStateSlice = {
  projects: Project[]
  docs: DocRef[]
  modelOptions: ModelOptionPublic[]
}

// AI : per-project runs only — background prefetch no longer duplicates projects/docs/allRuns.
export type ProjectRunsSlice = {
  runs: PipelineRun[]
}

export type CachedServerState = AccountStateSlice & {
  runs: PipelineRun[]
  allRuns: PipelineRun[]
}

type CacheEntry<T> = {
  data: T
  fetchedAt: number
  bytes: number
}

let accountSlice: CacheEntry<AccountStateSlice> | null = null
let billingRunsCache: CacheEntry<PipelineRun[]> | null = null
const projectRunsById = new Map<string, CacheEntry<ProjectRunsSlice>>()
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
  const docCount = accountSlice?.data.docs.length ?? 0
  return [...projectRunsById.entries()].map(([projectId, entry]) => ({
    projectId,
    bytes: entry.bytes,
    fetchedAt: entry.fetchedAt,
    docCount,
    runCount: entry.data.runs.length,
  }))
}

export function getProjectStateCacheTotalBytes(): number {
  let total = accountSlice?.bytes ?? 0
  total += billingRunsCache?.bytes ?? 0
  for (const entry of projectRunsById.values()) total += entry.bytes
  return total
}

export function readAccountStateCache(): AccountStateSlice | null {
  return accountSlice?.data ?? null
}

export function writeAccountStateCache(data: AccountStateSlice): void {
  accountSlice = {
    data,
    fetchedAt: Date.now(),
    bytes: estimateJsonBytes(data),
  }
  notifyCacheListeners()
}

export function readProjectRunsCache(projectId: string): ProjectRunsSlice | null {
  if (!projectId) return null
  return projectRunsById.get(projectId)?.data ?? null
}

export function writeProjectRunsCache(projectId: string, runs: PipelineRun[]): void {
  if (!projectId) return
  const data = { runs }
  projectRunsById.set(projectId, {
    data,
    fetchedAt: Date.now(),
    bytes: estimateJsonBytes(data),
  })
  notifyCacheListeners()
}

export function readBillingRunsCache(): PipelineRun[] | null {
  return billingRunsCache?.data ?? null
}

export function writeBillingRunsCache(runs: PipelineRun[]): void {
  billingRunsCache = {
    data: runs,
    fetchedAt: Date.now(),
    bytes: estimateJsonBytes(runs),
  }
  notifyCacheListeners()
}

export function readProjectStateCache(projectId: string): CachedServerState | null {
  const account = readAccountStateCache()
  if (!account) return null
  const projectRuns = projectId ? readProjectRunsCache(projectId) : null
  const billingRuns = readBillingRunsCache()
  return {
    ...account,
    runs: projectRuns?.runs ?? [],
    allRuns: billingRuns ?? [],
  }
}

export function writeProjectStateCache(projectId: string, data: CachedServerState): void {
  writeAccountStateCache({
    projects: data.projects,
    docs: data.docs,
    modelOptions: data.modelOptions,
  })
  if (projectId) writeProjectRunsCache(projectId, data.runs)
  if (data.allRuns.length) writeBillingRunsCache(data.allRuns)
}

export function clearProjectStateCache(projectId: string): void {
  if (!projectId) return
  projectRunsById.delete(projectId)
  notifyCacheListeners()
}

export function warmProjectPrefetches(
  projectIds: readonly string[],
  prefetch: (projectId: string) => void,
): void {
  for (const projectId of projectIds) prefetch(projectId)
}
