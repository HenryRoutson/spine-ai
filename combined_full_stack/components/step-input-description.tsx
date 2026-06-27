"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PipelineModule, RunStep } from "@/lib/types"
import {
  LOGGING_SETTINGS_CHANGED_EVENT,
  readHideInputDescriptionsDefault,
} from "@/lib/logging-settings"
import { compactPreview, PREVIEW_STEP_IO_CHARS } from "@/lib/text-preview"

export function useHideInputDescriptionsDefault(): boolean {
  const [hide, setHide] = useState(() => readHideInputDescriptionsDefault())
  useEffect(() => {
    const onChange = () => setHide(readHideInputDescriptionsDefault())
    window.addEventListener(LOGGING_SETTINGS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(LOGGING_SETTINGS_CHANGED_EVENT, onChange)
  }, [])
  return hide
}

export function resolveStepInputDescription(
  step: Pick<RunStep, "moduleId" | "inputDescription">,
  modules?: PipelineModule[],
): string | undefined {
  const fromStep = step.inputDescription?.trim()
  if (fromStep) return fromStep
  return modules?.find((m) => m.id === step.moduleId)?.inputDescription?.trim() || undefined
}

export function moduleInputDescription(m: Pick<PipelineModule, "inputDescription">): string | undefined {
  return m.inputDescription?.trim() || undefined
}

export function StepInputDescription({
  description,
  forceVisible = false,
  className,
}: {
  description?: string
  forceVisible?: boolean
  className?: string
}) {
  const hideByDefault = useHideInputDescriptionsDefault()
  const [open, setOpen] = useState(() => forceVisible || !hideByDefault)
  const text = description?.trim()

  useEffect(() => {
    if (forceVisible) setOpen(true)
    else setOpen(!hideByDefault)
  }, [hideByDefault, forceVisible])

  if (!text) return null

  const summary = compactPreview(text, PREVIEW_STEP_IO_CHARS)

  return (
    <div className={cn(className)}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-w-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} />
          Input description
        </button>
        {!open && (
          <span
            className={cn(
              "max-w-[220px] truncate font-mono text-[10px]",
              forceVisible ? "text-destructive/90" : "text-muted-foreground/80",
            )}
            title={text}
          >
            {summary}
          </span>
        )}
      </div>
      {open && (
        <p
          className={cn(
            "mt-1 rounded border px-2 py-1.5 font-mono text-[10px] leading-relaxed",
            forceVisible
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-border bg-muted/20 text-muted-foreground",
          )}
        >
          {text}
        </p>
      )}
    </div>
  )
}
