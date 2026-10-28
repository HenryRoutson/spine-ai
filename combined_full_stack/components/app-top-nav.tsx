"use client"

import type { AppAreaConfig } from "@/lib/app-nav-config"
import { windowToArea } from "@/lib/app-nav-config"
import type { AppWindowId } from "@/lib/app-shell"
import { cn } from "@/lib/utils"

type AppTopNavProps = {
  areas: AppAreaConfig[]
  activeWindow: AppWindowId
  onSelectArea: (area: AppAreaConfig) => void
  consumer?: boolean
}

export function AppTopNav({ areas, activeWindow, onSelectArea, consumer = false }: AppTopNavProps) {
  const activeAreaId = windowToArea(activeWindow, consumer)

  return (
    <nav
      aria-label="App sections"
      className="flex shrink-0 items-center gap-0.5 border-b border-border bg-background px-4"
    >
      {areas.map((area) => {
        const Icon = area.icon
        const active = area.id === activeAreaId
        return (
          <button
            key={area.id}
            type="button"
            onClick={() => onSelectArea(area)}
            className={cn(
              "relative flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{area.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
