"use client"

import { AlertTriangle, ChevronRight } from "lucide-react"
import { BUILD_STEPS } from "@/lib/app-nav-config"
import type { AppWindowId } from "@/lib/app-shell"
import {
  workspaceNavTabDisabled,
  workspaceNavTabIssue,
  workspaceNavTabTitle,
  type WorkspaceValidity,
} from "@/lib/workspace-validity-ui"
import { cn } from "@/lib/utils"

type BuildWorkflowStepperProps = {
  activeWindow: AppWindowId
  onSelect: (window: AppWindowId) => void
  validity?: WorkspaceValidity
}

export function BuildWorkflowStepper({ activeWindow, onSelect, validity }: BuildWorkflowStepperProps) {
  return (
    <nav
      aria-label="Build workflow"
      className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 bg-muted/15 px-4 py-2"
    >
      {BUILD_STEPS.map((step, index) => {
        const Icon = step.icon
        const active = activeWindow === step.id
        const issue = validity ? workspaceNavTabIssue(step.id, validity) : null
        const disabled = validity ? workspaceNavTabDisabled(step.id, validity) : false
        const title = validity ? workspaceNavTabTitle(step.id, step.label, validity) : step.label

        return (
          <div key={step.id} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight className="h-3 w-3 text-muted-foreground/50" aria-hidden /> : null}
            <button
              type="button"
              title={title}
              disabled={disabled}
              onClick={() => {
                if (disabled) return
                onSelect(step.id)
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
                <span className="text-[10px] text-primary">{step.hint}</span>
              )}
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{step.label}</span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}
