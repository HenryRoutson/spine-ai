import {
  readProjectRunsCache,
  writeProjectRunsCache,
} from "@/lib/project-state-cache"
import type { PipelineRun } from "@/lib/types"

export type BackgroundPrefetchProgress = {
  done: number
  total: number
  active: boolean
}

const idle: BackgroundPrefetchProgress = { done: 0, total: 0, active: false }

let progress: BackgroundPrefetchProgress = idle
const listeners = new Set<() => void>()
let queuedKey = ""

function notify(): void {
  for (const listener of listeners) listener()
}

export function subscribeBackgroundPrefetch(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getBackgroundPrefetchProgress(): BackgroundPrefetchProgress {
  return progress
}

// AI : prefetch slim project runs only — account slice is already hydrated once.
export function queueBackgroundProjectPrefetches(
  projectIds: readonly string[],
  fetchProjectRuns: (projectId: string) => Promise<PipelineRun[]>,
): void {
  const pending = projectIds.filter((id) => id && !readProjectRunsCache(id))
  const key = pending.join(",")
  if (!pending.length) {
    if (progress.active) {
      progress = idle
      notify()
    }
    return
  }
  if (key === queuedKey && progress.active) return
  queuedKey = key

  progress = { done: 0, total: pending.length, active: true }
  notify()

  void (async () => {
    for (const projectId of pending) {
      try {
        const runs = await fetchProjectRuns(projectId)
        writeProjectRunsCache(projectId, runs)
      } catch {
        // AI : skip failed background prefetches — hover/open will retry.
      }
      progress = { ...progress, done: progress.done + 1 }
      notify()
    }
    progress = { ...progress, active: false }
    notify()
  })()
}
