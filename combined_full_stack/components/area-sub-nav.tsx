"use client"

import { AlertTriangle } from "lucide-react"
import type { AppArea, AppNavItem } from "@/lib/app-nav-config"
import { AREA_SUB_NAV } from "@/lib/app-nav-config"
import type { AppWindowId } from "@/lib/app-shell"
import {
  workspaceNavTabDisabled,
  workspaceNavTabIssue,
  workspaceNavTabTitle,
  type WorkspaceValidity,
} from "@/lib/workspace-validity-ui"
import { cn } from "@/lib/utils"

type AreaSubNavProps = {
  area: AppArea
  activeWindow: AppWindowId
  onSelect: (window: AppWindowId) => void
  validity?: WorkspaceValidity
}

export function AreaSubNav({ area, activeWindow, onSelect, validity }: AreaSubNavProps) {
  const items = AREA_SUB_NAV[area]
  if (!items || items.length < 2) return null

  return (
    <nav
      aria-label={`${area} views`}
      className="flex shrink-0 items-center gap-1 border-b border-border/60 bg-muted/20 px-4 py-1.5"
    >
      {items.map((item) => (
        <AreaSubNavItem
          key={item.id}
          item={item}
          active={activeWindow === item.id}
          onSelect={() => onSelect(item.id)}
          validity={validity}
        />
      ))}
    </nav>
  )
}

function AreaSubNavItem({
  item,
  active,
  onSelect,
  validity,
}: {
  item: AppNavItem
  active: boolean
  onSelect: () => void
  validity?: WorkspaceValidity
}) {
  const issue = validity ? workspaceNavTabIssue(item.id, validity) : null
  const disabled = validity ? workspaceNavTabDisabled(item.id, validity) : false
  const title = validity ? workspaceNavTabTitle(item.id, item.label, validity) : item.label

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        onSelect()
      }}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active && !issue && "bg-background text-foreground shadow-sm",
        !active && !issue && "text-muted-foreground hover:bg-background/70 hover:text-foreground",
        issue && "text-destructive hover:bg-destructive/10",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {issue ? <AlertTriangle className="h-3 w-3 shrink-0" /> : null}
      {item.label}
    </button>
  )
}
