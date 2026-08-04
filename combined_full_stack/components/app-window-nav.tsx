"use client"

import { AlertTriangle } from "lucide-react"
import { BUILDER_WORKSPACE_NAV_ITEMS, CONSUMER_NAV_ITEMS, type AppNavItem } from "@/lib/app-nav-config"
import type { AppWindowId } from "@/lib/app-shell"
import {
  workspaceNavTabDisabled,
  workspaceNavTabIssue,
  workspaceNavTabTitle,
  type WorkspaceValidity,
} from "@/lib/workspace-validity-ui"
import { cn } from "@/lib/utils"
import { prefetchWorkspacePanel } from "@/lib/prefetch-workspace-panel"

type AppWindowNavProps = {
  activeWindow: AppWindowId
  onSelect: (window: AppWindowId) => void
  validity?: WorkspaceValidity
  items?: AppNavItem[]
}

// AI : flat numbered horizontal workspace tabs — replaces area + sub-nav layers.
export function AppWindowNav({ activeWindow, onSelect, validity, items = BUILDER_WORKSPACE_NAV_ITEMS }: AppWindowNavProps) {
  return (
    <nav
      aria-label="Workspace"
      className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 bg-muted/15 px-4 py-2"
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = activeWindow === item.id
        const issue = validity ? workspaceNavTabIssue(item.id, validity) : null
        const disabled = validity ? workspaceNavTabDisabled(item.id, validity) : false
        const title = validity ? workspaceNavTabTitle(item.id, item.label, validity) : item.label

        return (
          <button
            key={item.id}
            type="button"
            title={title}
            disabled={disabled}
            onMouseEnter={() => prefetchWorkspacePanel(item.id)}
            onFocus={() => prefetchWorkspacePanel(item.id)}
            onClick={() => {
              if (disabled) return
              onSelect(item.id)
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
              active && !issue && "bg-background text-foreground shadow-sm ring-1 ring-border",
              !active && !issue && "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              issue && "text-destructive hover:bg-destructive/10",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {issue ? (
              <AlertTriangle className="h-3 w-3 shrink-0" />
            ) : (
              <span className="text-[10px] text-primary">{item.hint}</span>
            )}
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
