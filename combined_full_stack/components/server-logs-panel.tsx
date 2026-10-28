"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Maximize2 } from "lucide-react"
import { ServerLogLineHighlight } from "@/components/highlight"
import { cn } from "@/lib/utils"
import type { JobLogEntry } from "@/lib/types"
import {
  LOGGING_SETTINGS_CHANGED_EVENT,
  readHideServerLogsDefault,
} from "@/lib/logging-settings"
import { useBrowserPrefEvent } from "@/lib/use-browser-pref-event"
import { compactPreview, PREVIEW_SERVER_LOGS_CHARS } from "@/lib/text-preview"

export function useHideServerLogsDefault(): boolean {
  return useBrowserPrefEvent(LOGGING_SETTINGS_CHANGED_EVENT, readHideServerLogsDefault)
}

export function serverLogsPlainText(logs: JobLogEntry[]): string {
  return logs.map((l) => l.line).join("\n")
}

export function serverLogsPreview(logs: JobLogEntry[], max = PREVIEW_SERVER_LOGS_CHARS): string {
  return compactPreview(serverLogsPlainText(logs), max)
}

export function ServerLogLines({
  logs,
  className,
}: {
  logs: JobLogEntry[]
  className?: string
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      {logs.map((l, i) => (
        <div key={`${l.at}-${i}`} className="whitespace-pre-wrap break-words">
          <ServerLogLineHighlight line={l.line} level={l.level} tag={l.tag} />
        </div>
      ))}
    </div>
  )
}

export function StepServerLogsSection({
  logs,
  onExpand,
  className,
  forceCollapsed = false,
}: {
  logs: JobLogEntry[]
  onExpand?: (logs: JobLogEntry[]) => void
  className?: string
  forceCollapsed?: boolean
}) {
  const hideByDefault = useHideServerLogsDefault()
  const [open, setOpen] = useState(() => !hideByDefault)

  useEffect(() => {
    if (forceCollapsed) setOpen(false)
    else setOpen(!hideByDefault)
  }, [hideByDefault, forceCollapsed])

  if (!logs.length) return null

  const summary = serverLogsPreview(logs)

  return (
    <div className={cn("mt-2 pl-7", className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-w-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} />
          Server logs
          <span className="normal-case text-muted-foreground/70">({logs.length} line{logs.length === 1 ? "" : "s"})</span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {!open && (
            <span className="max-w-[200px] truncate font-mono text-[10px] text-muted-foreground/80" title={summary}>
              {summary}
            </span>
          )}
          {onExpand && (
            <button
              type="button"
              onClick={() => onExpand(logs)}
              className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Open in full-screen viewer"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="max-h-48 overflow-y-auto rounded border border-border bg-muted/20 p-2 font-mono text-[10px] leading-snug">
          <ServerLogLines logs={logs} />
        </div>
      )}
    </div>
  )
}
