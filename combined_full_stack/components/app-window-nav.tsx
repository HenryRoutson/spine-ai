"use client"

import type { ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { BUILDER_WORKSPACE_NAV_ITEMS, type AppNavItem } from "@/lib/app-nav-config"
import type { AppWindowId } from "@/lib/app-shell"
import {
  workspaceNavTabDisabled,
  workspaceNavTabIssue,
  workspaceNavTabTitle,
  type WorkspaceValidity,
} from "@/lib/workspace-validity-ui"
import { cn } from "@/lib/utils"
import { prefetchWorkspacePanel } from "@/lib/prefetch-workspace-panel"
import { uiContextTargetProps } from "@/lib/ui-context-dom"

type AppWindowNavProps = {
  activeWindow: AppWindowId
  onSelect: (window: AppWindowId) => void
  validity?: WorkspaceValidity
  items?: AppNavItem[]
  // AI : Build|Vibe surface toggle — shared under L0 Build with workspace tabs.
  leading?: ReactNode
  showItems?: boolean
  // AI : Agent lives on Build editors chrome (not L0 header) to separate from Vibe.
  trailing?: ReactNode
}

// AI : flat numbered horizontal workspace tabs — replaces area + sub-nav layers.
export function AppWindowNav({
  activeWindow,
  onSelect,
  validity,
  items = BUILDER_WORKSPACE_NAV_ITEMS,
  leading,
  showItems = true,
  trailing,
}: AppWindowNavProps) {
  if (!leading && !showItems && !trailing) return null

  return (
    <nav
      aria-label="Workspace"
      className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 bg-muted/15 px-4 py-2"
    >
      {leading ? (
        <>
          <div className="flex shrink-0 items-center gap-2">{leading}</div>
          {showItems ? <div className="mx-1 hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden /> : null}
        </>
      ) : null}
      {showItems
        ? items.map((item) => {
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
                {...uiContextTargetProps({
                  kind: "generic",
                  id: `window:${item.id}`,
                  label: `Tab · ${item.label}`,
                  snippet: issue ? `issue: ${issue}` : active ? "active workspace tab" : "workspace tab",
                })}
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
          })
        : null}
      {trailing ? <div className="ml-auto flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </nav>
  )
}
