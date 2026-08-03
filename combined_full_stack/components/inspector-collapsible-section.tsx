"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { INSPECTOR_SECTION_BORDER_CLASS, INSPECTOR_SECTION_TITLE_CLASS } from "@/lib/ui-classes"

type InspectorCollapsibleSectionProps = {
  title: React.ReactNode
  defaultOpen?: boolean
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  variant?: "panel" | "section"
  fill?: boolean
}

// AI : boxed collapsible sections for pipeline inspector panels.
export function InspectorCollapsibleSection({
  title,
  defaultOpen = true,
  actions,
  children,
  className,
  variant = "section",
  fill = false,
}: InspectorCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const isPanel = variant === "panel"

  return (
    <div
      className={cn(
        isPanel
          ? "bg-transparent"
          : cn("rounded-lg border bg-card/50", INSPECTOR_SECTION_BORDER_CLASS),
        fill && "flex min-h-0 flex-1 flex-col",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          isPanel ? cn("border-b px-3 py-2", INSPECTOR_SECTION_BORDER_CLASS) : "px-3 py-2",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md text-left",
            !isPanel && "-mx-1 px-1 py-0.5 hover:bg-muted/30",
          )}
        >
          <span className={INSPECTOR_SECTION_TITLE_CLASS}>{title}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {actions ? (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        ) : null}
      </div>
      {open ? (
        <div
          className={cn(
            !isPanel && cn("border-t", INSPECTOR_SECTION_BORDER_CLASS),
            isPanel ? "p-3" : "px-3 pb-3 pt-2",
            fill && "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
