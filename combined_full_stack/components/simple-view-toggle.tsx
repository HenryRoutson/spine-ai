"use client"

import { useCallback } from "react"
import { LayoutList } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  LOGGING_SETTINGS_CHANGED_EVENT,
  readSimpleStepTrace,
  writeSimpleStepTrace,
} from "@/lib/logging-settings"
import { useBrowserPrefEvent } from "@/lib/use-browser-pref-event"
import { cn } from "@/lib/utils"

export function useSimpleStepTrace(fallback: boolean): [boolean, (value: boolean) => void] {
  const read = useCallback(() => readSimpleStepTrace(fallback), [fallback])
  const value = useBrowserPrefEvent(LOGGING_SETTINGS_CHANGED_EVENT, read)
  return [value, writeSimpleStepTrace]
}

export function SimpleViewToggle({
  checked,
  onCheckedChange,
  className,
}: {
  checked: boolean
  onCheckedChange: (value: boolean) => void
  className?: string
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 transition-colors",
        checked ? "border-border bg-muted/20" : "border-border bg-background",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
        <LayoutList className="h-3 w-3 shrink-0" />
        Simplified
      </span>
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(!!next)}
        data-spine-id="logging.simple-view"
      />
    </label>
  )
}
