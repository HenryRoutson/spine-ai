// AI : in-memory cache for the Cache tab — avoids refetching the full list on every tab switch.

import type { DocId, ModelId, ModuleId, ProjectId } from "@/lib/types"

export type CacheEntryRow = {
  key: string
  projectId: ProjectId
  projectName?: string
  moduleId: ModuleId
  moduleLabel?: string
  model: ModelId
  inputDocIds: DocId[]
  hits: number
  costCents?: number
  lastHitAt?: number
  createdAt?: number
  inputPreview?: string
  sizeBytes: number
}

export type CacheEntryDetail = CacheEntryRow & {
  outputJson: string
  docId?: DocId
  inputPreviewItems?: import("@/lib/types").InputPreviewItem[]
  outputPreviewItems?: import("@/lib/types").InputPreviewItem[]
}

type cache_list_key_string = string

const listCache = new Map<cache_list_key_string, CacheEntryRow[]>()
const detailCache = new Map<string, CacheEntryDetail>()

export function cacheListKey(params: {
  projectId: ProjectId
  scope: "project" | "all"
  query: string
  searchFields: { step: boolean; input: boolean; output: boolean }
}): cache_list_key_string {
  return JSON.stringify(params)
}

export function readCachedCacheList(key: cache_list_key_string): CacheEntryRow[] | undefined {
  return listCache.get(key)
}

export function writeCachedCacheList(key: cache_list_key_string, entries: CacheEntryRow[]): void {
  listCache.set(key, entries)
}

export function readCachedCacheDetail(key: string): CacheEntryDetail | undefined {
  return detailCache.get(key)
}

export function writeCachedCacheDetail(key: string, entry: CacheEntryDetail): void {
  detailCache.set(key, entry)
}
