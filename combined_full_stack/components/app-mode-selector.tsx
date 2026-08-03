"use client"

import { Hammer, Play } from "lucide-react"
import type { AppMode } from "@/lib/app-mode-nav"
import { cn } from "@/lib/utils"

type AppModeSelectorProps = {
  value: AppMode
  onChange: (mode: AppMode) => void
  className?: string
}

// AI : L0 decision — Run shared pipelines vs Build pipelines (spec navigation model).
export function AppModeSelector({ value, onChange, className }: AppModeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="What do you want to do?"
      className={cn(
        "inline-flex shrink-0 rounded-lg border border-border bg-muted/30 p-0.5",
        className,
      )}
    >
      <ModeButton
        active={value === "run"}
        onClick={() => onChange("run")}
        icon={Play}
        label="Run shared pipelines"
        shortLabel="Run"
        title="Run pipelines someone shared with you"
      />
      <ModeButton
        active={value === "build"}
        onClick={() => onChange("build")}
        icon={Hammer}
        label="Build pipelines"
        shortLabel="Build"
        title="Create and edit your own pipelines"
      />
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
  shortLabel,
  title,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  shortLabel: string
  title: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
