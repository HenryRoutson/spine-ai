import {
  readProjectStateCache,
  writeProjectStateCache,
  type CachedServerState,
} from "@/lib/project-state-cache"

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

// AI : load non-active projects one at a time so the open project keeps bandwidth.
export function queueBackgroundProjectPrefetches(
  projectIds: readonly string[],
  fetchState: (projectId: string) => Promise<CachedServerState>,
): void {
  const pending = projectIds.filter((id) => id && !readProjectStateCache(id))
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
        const data = await fetchState(projectId)
        writeProjectStateCache(projectId, data)
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
