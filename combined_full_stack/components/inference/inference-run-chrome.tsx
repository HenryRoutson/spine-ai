"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Loader2,
  ScrollText,
  UserCheck,
  X,
} from "lucide-react"
import { JsonHighlight } from "@/components/highlight"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { copyTextToClipboard } from "@/lib/clipboard"
import { formatErrorForClipboard } from "@/lib/error-copy"
import type { RunErrorDisplay } from "@/lib/run-errors"
import type { ClientStepSpec } from "@/lib/run-types"
import type { PipelineModule } from "@/lib/types"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"

type InferencePhase = "idle" | "running" | "done"

export function InferenceRunSection({
  title,
  subtitle,
  variant = "current",
  children,
  className,
}: {
  title: string
  subtitle?: string
  variant?: "current" | "last"
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-lg border p-4",
        variant === "last"
          ? "border-primary/25 bg-primary/[0.03]"
          : "border-border bg-card",
        className,
      )}
    >
      <header className="mb-4 border-b border-border pb-3">
        <h2
          className={cn(
            "font-mono text-[10px] uppercase tracking-wider",
            variant === "last" ? "text-primary" : "text-muted-foreground",
          )}
        >
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function InferenceCollapsibleSection({
  title,
  phase,
  collapseOnRun = true,
  // AI : TODO (spec) — default true: collapse non-output sections when inference run finishes.
  collapseOnDone = false,
  children,
}: {
  title: string
  phase: InferencePhase
  collapseOnRun?: boolean
  collapseOnDone?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (phase === "idle") setOpen(true)
    else if (phase === "running" && collapseOnRun) setOpen(false)
    else if (phase === "done" && collapseOnDone) setOpen(false)
  }, [phase, collapseOnRun, collapseOnDone])

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/30"
      >
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{title}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="border-t border-border p-3 pt-2">{children}</div> : null}
    </div>
  )
}

export function GoToLoggingButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      className={cn(
        "w-full gap-1.5",
        "animate-in fade-in slide-in-from-bottom-2 duration-500",
        "motion-safe:animate-[pulse_2s_ease-in-out_infinite] motion-safe:ring-2 motion-safe:ring-primary/30",
        className,
      )}
      onClick={onClick}
    >
      <ScrollText className="h-3.5 w-3.5" />
      Go to logging
    </Button>
  )
}

export function CyclingWaitPhrase({ phrase, className }: { phrase: string; className?: string }) {
  return (
    <p
      key={phrase}
      className={cn(
        "animate-in fade-in duration-500 font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      {phrase}…
    </p>
  )
}

export function RunErrorSummary({
  display,
  technical,
  uiLocation = "Inference → Last run → error summary",
  className,
}: {
  display: RunErrorDisplay
  technical?: string | null
  uiLocation?: string
  className?: string
}) {
  const [showTechnical, setShowTechnical] = useState(false)
  const copyText =
    technical ??
    formatErrorForClipboard({
      uiLocation,
      summary: display.message,
      detail: display.detail,
      context: display.stepLabel ? { "Pipeline step": display.stepLabel } : undefined,
    })

  return (
    <div className={cn("mx-auto max-w-md space-y-3", className)}>
      <div>
        <p className="text-sm font-medium text-destructive">{display.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{display.message}</p>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">
        Fix the issue above, adjust inputs if needed, then run again. Step traces stay in Logging.
      </p>
      {(display.detail || technical) && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 bg-transparent px-2 text-[10px]"
            onClick={() => setShowTechnical((v) => !v)}
          >
            {showTechnical ? "Hide technical details" : "Show technical details"}
          </Button>
          {showTechnical && (
            <ErrorBanner text={copyText} copyText={copyText} uiLocation={uiLocation} />
          )}
        </div>
      )}
    </div>
  )
}

export function ErrorBanner({
  text,
  copyText,
  uiLocation = "Error banner",
}: {
  text: string
  copyText?: string
  uiLocation?: string
}) {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  async function copyError() {
    const payload =
      copyText ??
      formatErrorForClipboard({
        uiLocation,
        summary: text,
      })
    await copyTextToClipboard(payload)
    setCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
      <p className="min-w-0 flex-1 font-mono text-[11px] text-destructive">{text}</p>
      <Button
        variant="outline"
        size="sm"
        className="h-6 shrink-0 gap-1 bg-transparent px-2 text-[10px]"
        onClick={() => void copyError()}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy error"}
      </Button>
    </div>
  )
}

export function HumanReviewPanel({
  spec,
  module,
  onApprove,
  onReject,
}: {
  spec: ClientStepSpec
  module?: PipelineModule
  onApprove: () => void | Promise<void>
  onReject: () => void | Promise<void>
}) {
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null)

  const previewJson = useMemo(() => {
    try {
      return JSON.stringify(spec.input, null, 2)
    } catch {
      return String(spec.input)
    }
  }, [spec.input])

  return (
    <div className="rounded-lg border border-chart-1/50 bg-chart-1/5 p-4">
      <div className="flex items-start gap-3">
        <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-chart-1" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-medium">Human review required</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              Step · {spec.label}
            </p>
            {module?.note?.trim() && (
              <p className="mt-2 text-xs text-muted-foreground">{module.note.trim()}</p>
            )}
          </div>
          <div className="max-h-64 min-w-0 overflow-auto rounded-md border border-border bg-[oklch(0.14_0.004_264)] p-2">
            <JsonHighlight json={previewJson} />
          </div>
          {/* AI : todo — approve/reject settle animations (pulse on click, panel dismiss transition) */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={pendingAction !== null}
              onClick={() => {
                if (pendingAction) return
                setPendingAction("approve")
                void Promise.resolve(onApprove()).finally(() => setPendingAction(null))
              }}
            >
              {pendingAction === "approve" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={pendingAction !== null}
              onClick={() => {
                if (pendingAction) return
                setPendingAction("reject")
                void Promise.resolve(onReject()).finally(() => setPendingAction(null))
              }}
            >
              {pendingAction === "reject" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Reject
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
