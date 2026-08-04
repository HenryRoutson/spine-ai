"use client"

import { useSyncExternalStore } from "react"
import {
  getBackgroundPrefetchProgress,
  subscribeBackgroundPrefetch,
} from "@/lib/background-project-prefetch"
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress"

function useBackgroundPrefetchProgress() {
  return useSyncExternalStore(
    subscribeBackgroundPrefetch,
    getBackgroundPrefetchProgress,
    getBackgroundPrefetchProgress,
  )
}

// AI : thin footer bar while other projects warm in the background.
export function BackgroundPrefetchBar() {
  const { done, total, active } = useBackgroundPrefetchProgress()
  if (!active || total === 0) return null

  const pct = Math.round((done / total) * 100)

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/90 px-3 py-1.5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <p className="shrink-0 font-mono text-[10px] text-muted-foreground">
          warming {done}/{total} projects
        </p>
        <Progress value={pct} className="min-w-0 flex-1 gap-0">
          <ProgressTrack className="h-1">
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
      </div>
    </div>
  )
}
