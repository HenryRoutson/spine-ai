"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { IoPager } from "@/components/logging/io-pager"
import { cn } from "@/lib/utils"
import type { InputDescriptionCheckItem, InputDescriptionCheckResult, PipelineModule, RunStep } from "@/lib/types"
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

function CheckMatchLine({ matches, reason }: { matches: boolean; reason: string }) {
  return (
    <p
      className={cn(
        "mt-1 rounded border px-2 py-1.5 font-mono text-[10px] leading-relaxed",
        matches
          ? "border-border bg-muted/20 text-muted-foreground"
          : "border-destructive/40 bg-destructive/5 text-destructive",
      )}
    >
      <span className="font-medium">{matches ? "matches: true" : "matches: false"}</span>
      {reason ? ` — ${reason}` : ""}
    </p>
  )
}

function itemCheckReason(check: InputDescriptionCheckResult, item?: InputDescriptionCheckItem): string {
  const rejected = check.matches === false
  const failed = check.items?.find((entry) => !entry.matches)
  if (!rejected) return item?.reason.trim() ?? ""
  if (item && !item.matches) return item.reason.trim() || check.reason.trim()
  return check.reason.trim() || failed?.reason.trim() || ""
}

function InputDescriptionCheckPanel({
  check,
  forceVisible,
}: {
  check: InputDescriptionCheckResult
  forceVisible?: boolean
}) {
  const listItems = check.items?.length ? check.items : undefined
  const rejected = check.matches === false

  if (!listItems) {
    if (!rejected) return null
    return <CheckMatchLine matches={false} reason={check.reason.trim()} />
  }

  return (
    <div className="mt-1">
      <IoPager
        items={listItems.map((item, i) => ({
          label: item.label?.trim() || `item ${i + 1}`,
          text: item.reason,
        }))}
        renderItem={(_, i) => {
          const item = listItems[i]!
          const reason = itemCheckReason(check, item)
          if (rejected) return <CheckMatchLine matches={false} reason={reason} />
          if (listItems.length > 1 && (forceVisible || item)) {
            return <CheckMatchLine matches={true} reason={reason} />
          }
          return null
        }}
      />
    </div>
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
      {rejected && !showCheckPanel && check?.reason.trim() ? (
        <CheckMatchLine matches={false} reason={check.reason.trim()} />
      ) : null}
    </div>
  )
}
