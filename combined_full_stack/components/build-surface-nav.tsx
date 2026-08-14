"use client"

import { Hammer, Sparkles } from "lucide-react"
import {
  BUILD_SURFACE_NAV,
  BuildSurface,
} from "@/lib/build-surface"
import { prefetchBuildPanel } from "@/lib/prefetch-build-panel"
import { prefetchWorkspacePanel } from "@/lib/prefetch-workspace-panel"
import { AppWindowId } from "@/lib/app-window-id"
import { cn } from "@/lib/utils"
import { spineActionProps } from "@/lib/core/parity"
import { useCallback } from "react"

type BuildSurfaceNavProps = {
  value: BuildSurface
  onChange: (surface: BuildSurface) => void
  className?: string
}

// AI : L0 Build sub-decision — Vibe vs visual editors (same project selector).
export function BuildSurfaceNav({ value, onChange, className }: BuildSurfaceNavProps) {
  const warmVibe = useCallback(() => {
    prefetchWorkspacePanel(AppWindowId.Vibe)
    prefetchBuildPanel()
  }, [])
  const warmEditors = useCallback(() => {
    prefetchBuildPanel()
  }, [])

  return (
    <div
      role="group"
      aria-label="Build surface"
      className={cn(
        "inline-flex shrink-0 rounded-md border border-border/80 bg-background/80 p-0.5",
        className,
      )}
    >
      <SurfaceButton
        active={value === BuildSurface.Vibe}
        onClick={() => onChange(BuildSurface.Vibe)}
        onWarm={warmVibe}
        icon={Sparkles}
        spineId="nav.build.vibe"
        {...BUILD_SURFACE_NAV[BuildSurface.Vibe]}
      />
      <SurfaceButton
        active={value === BuildSurface.Editors}
        onClick={() => onChange(BuildSurface.Editors)}
        onWarm={warmEditors}
        icon={Hammer}
        spineId="nav.build.editors"
        {...BUILD_SURFACE_NAV[BuildSurface.Editors]}
      />
    </div>
  )
}

function SurfaceButton({
  active,
  onClick,
  onWarm,
  icon: Icon,
  label,
  title,
  spineId,
}: {
  active: boolean
  onClick: () => void
  onWarm?: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  title: string
  spineId: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={onWarm}
      onFocus={onWarm}
      {...spineActionProps(spineId)}
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] transition-colors",
        active
          ? "bg-muted text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  )
}
