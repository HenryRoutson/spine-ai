"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { uiContextTargetProps } from "@/lib/ui-context-dom"
import type { UiContextKind } from "@/lib/ui-context-types"

// AI : page-local entity lists — visually distinct from L1 app top nav (muted inset rail).

type EntityRailProps = {
  children: ReactNode
  className?: string
}

export function EntityRail({ children, className }: EntityRailProps) {
  return (
    <aside
      className={cn(
        "flex min-h-0 w-[200px] shrink-0 flex-col overflow-hidden border-r border-border/80 bg-muted/25",
        className,
      )}
    >
      {children}
    </aside>
  )
}

type EntityRailSectionProps = {
  title: string
  children: ReactNode
  action?: ReactNode
  className?: string
}

export function EntityRailSection({ title, children, action, className }: EntityRailSectionProps) {
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-1 border-b border-border/60 px-2.5 py-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{title}</span>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">{children}</div>
    </div>
  )
}

type EntityRailItemProps = {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
  disabled?: boolean
  uiContext?: {
    kind: UiContextKind
    id: string
    label: string
    snippet?: string
  }
}

export function EntityRailItem({
  active = false,
  onClick,
  children,
  className,
  disabled,
  uiContext,
}: EntityRailItemProps) {
  const Tag = onClick ? "button" : "div"
  const ctx = uiContext
    ? uiContextTargetProps({
        kind: uiContext.kind,
        id: uiContext.id,
        label: uiContext.label,
        snippet: uiContext.snippet,
      })
    : undefined
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "mb-0.5 flex w-full rounded-md px-2 py-1.5 text-left transition-colors",
        active
          ? "bg-background shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...ctx}
    >
      {children}
    </Tag>
  )
}
