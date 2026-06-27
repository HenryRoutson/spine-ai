"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { InputDescriptionCheckResult, PipelineModule, RunStep } from "@/lib/types"
import {
  LOGGING_SETTINGS_CHANGED_EVENT,
  readHideInputDescriptionsDefault,
} from "@/lib/logging-settings"
import { useBrowserPrefEvent } from "@/lib/use-browser-pref-event"
import { compactPreview, PREVIEW_STEP_IO_CHARS } from "@/lib/text-preview"

export function useHideInputDescriptionsDefault(): boolean {
  return useBrowserPrefEvent(LOGGING_SETTINGS_CHANGED_EVENT, readHideInputDescriptionsDefault)
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

function InputDescriptionCheckPanel({
  check,
  forceVisible,
}: {
  check: InputDescriptionCheckResult
  forceVisible?: boolean
}) {
  const listItems = check.items?.length ? check.items : undefined
  const [itemIndex, setItemIndex] = useState(0)

  useEffect(() => {
    setItemIndex(0)
  }, [check])

  const activeItem = listItems?.[itemIndex]
  const failedItems = listItems?.filter((item) => !item.matches) ?? []
  const rejected = check.matches === false
  const reason = (() => {
    if (!rejected) return activeItem?.reason.trim() ?? ""
    if (activeItem && !activeItem.matches) return activeItem.reason.trim() || check.reason.trim()
    return check.reason.trim() || failedItems[0]?.reason.trim() || ""
  })()

  return (
    <>
      {listItems && listItems.length > 1 && (
        <div className="mt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={itemIndex <= 0}
            onClick={() => setItemIndex((i) => Math.max(0, i - 1))}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Previous validation item"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-0 flex-1 truncate text-center font-mono text-[10px] text-muted-foreground">
            {activeItem?.label ?? `item ${itemIndex + 1}`}{" "}
            <span className="tabular-nums">
              ({itemIndex + 1}/{listItems.length})
            </span>
          </span>
          <button
            type="button"
            disabled={itemIndex >= listItems.length - 1}
            onClick={() => setItemIndex((i) => Math.min(listItems.length - 1, i + 1))}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Next validation item"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {rejected && (
        <p className="mt-1 rounded border border-destructive/40 bg-destructive/5 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-destructive">
          <span className="font-medium">matches: false</span>
          {reason ? ` — ${reason}` : ""}
        </p>
      )}
      {!rejected && listItems && listItems.length > 1 && (forceVisible || activeItem) && (
        <p className="mt-1 rounded border border-border bg-muted/20 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
          <span className="font-medium">matches: true</span>
          {reason ? ` — ${reason}` : ""}
        </p>
      )}
    </>
  )
}

export function StepInputDescription({
  description,
  check,
  forceVisible = false,
  className,
}: {
  description?: string
  check?: InputDescriptionCheckResult
  forceVisible?: boolean
  className?: string
}) {
  const hideByDefault = useHideInputDescriptionsDefault()
  const [open, setOpen] = useState(() => forceVisible || !hideByDefault)
  const text = description?.trim()
  const rejected = check?.matches === false
  const descFailed = rejected

  useEffect(() => {
    if (forceVisible || rejected) setOpen(true)
    else setOpen(!hideByDefault)
  }, [hideByDefault, forceVisible, rejected])

  if (!text && !rejected) return null

  const summary = text ? compactPreview(text, PREVIEW_STEP_IO_CHARS) : undefined
  const showCheckPanel = !!check && (check.matches === false || (check.items?.length ?? 0) > 1)

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
        {!open && summary && (
          <span
            className={cn(
              "max-w-[220px] truncate font-mono text-[10px]",
              descFailed ? "text-destructive/90" : "text-muted-foreground/80",
            )}
            title={text}
          >
            {summary}
          </span>
        )}
      </div>
      {showCheckPanel && <InputDescriptionCheckPanel check={check!} forceVisible={forceVisible} />}
      {open && text && (
        <p
          className={cn(
            "mt-1 rounded border px-2 py-1.5 font-mono text-[10px] leading-relaxed",
            descFailed
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-border bg-muted/20 text-muted-foreground",
          )}
        >
          {text}
        </p>
      )}
      {rejected && !showCheckPanel && check?.reason.trim() && (
        <p className="mt-1 rounded border border-destructive/40 bg-destructive/5 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-destructive">
          <span className="font-medium">matches: false</span>
          {` — ${check.reason.trim()}`}
        </p>
      )}
    </div>
  )
}
