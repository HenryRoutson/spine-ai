"use client"

import { Switch } from "@/components/ui/switch"
import { writeHideDeveloperTools } from "@/lib/developer-tools-settings"
import { prefetchBuildPanel } from "@/lib/prefetch-build-panel"
import { prefetchWorkspacePanel } from "@/lib/prefetch-workspace-panel"
import { AppWindowId } from "@/lib/app-window-id"
import { cn } from "@/lib/utils"
import { spineActionProps } from "@/lib/core/parity"
import { useCallback } from "react"

type BuildSurfaceNavProps = {
  simplified: boolean
  className?: string
}

// AI : Simplified on = former Vibe chrome (`nav.build.vibe`); off = former Building editors (`nav.build.editors`).
export function BuildSurfaceNav({ simplified, className }: BuildSurfaceNavProps) {
  const warmSimplified = useCallback(() => {
    prefetchWorkspacePanel(AppWindowId.Inference)
    prefetchWorkspacePanel(AppWindowId.Share)
  }, [])
  const warmFull = useCallback(() => {
    prefetchBuildPanel()
  }, [])

  return (
    <label
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border/80 bg-background/80 px-2 py-1",
        className,
      )}
      onMouseEnter={simplified ? warmFull : warmSimplified}
    >
      <Switch
        size="sm"
        checked={simplified}
        onCheckedChange={(checked) => writeHideDeveloperTools(!!checked)}
        {...spineActionProps(simplified ? "nav.build.vibe" : "nav.build.editors")}
      />
      <span className="font-mono text-[11px]">Simplified</span>
    </label>
  )
}
