"use client"

import { Loader2, Play, Square } from "lucide-react"
import { type MouseEvent, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type RunButtonSize = "sm" | "default"

const sizeClass: Record<RunButtonSize, string> = {
  sm: "h-8",
  default: "h-9",
}

const iconClass: Record<RunButtonSize, string> = {
  sm: "h-3.5 w-3.5",
  default: "h-4 w-4",
}

export function RunStopButton({
  onClick,
  className,
  label = "Stop",
  title,
  size = "sm",
  spineId = "jobs.stop",
}: {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  className?: string
  label?: string
  title?: string
  size?: RunButtonSize
  spineId?: string
}) {
  const resolvedTitle = title ?? (label === "Stop" ? "Stop this run" : label)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        "shrink-0 gap-1 border-destructive/40 bg-transparent px-2 text-destructive hover:bg-destructive/10 hover:text-destructive",
        sizeClass[size],
        className,
      )}
      onClick={onClick}
      title={resolvedTitle}
      aria-label={label}
      spineId={spineId}
    >
      <Square className={cn(iconClass[size], "fill-current")} />
      <span className="font-mono text-[10px]">{label}</span>
    </Button>
  )
}

export function RunWithStopButton({
  running,
  onRun,
  onStop,
  disabled = false,
  label = "Run",
  runningLabel = "Running…",
  stopLabel = "Stop",
  stopTitle,
  title,
  size = "sm",
  variant = "default",
  className,
  idleIcon,
  runButtonClassName,
  allowStartWhileRunning = false,
  spineId = "inference.start-run",
  stopSpineId = "inference.stop",
}: {
  running: boolean
  onRun: () => void
  onStop: (e: MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  label?: string
  runningLabel?: string
  stopLabel?: string
  stopTitle?: string
  title?: string
  size?: RunButtonSize
  variant?: "default" | "outline"
  className?: string
  idleIcon?: ReactNode
  runButtonClassName?: string
  allowStartWhileRunning?: boolean
  spineId?: string
  stopSpineId?: string
}) {
  const icon = iconClass[size]
  if (running) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Button
          size="sm"
          variant={variant}
          className={cn(sizeClass[size], runButtonClassName)}
          disabled={allowStartWhileRunning ? disabled : true}
          onClick={allowStartWhileRunning ? onRun : undefined}
          spineId={spineId}
        >
          {allowStartWhileRunning ? (
            <>
              {idleIcon ?? <Play className={cn(icon, "mr-1.5")} />}
              {label}
            </>
          ) : (
            <>
              <Loader2 className={cn(icon, "mr-1.5 animate-spin")} />
              {runningLabel}
            </>
          )}
        </Button>
        <RunStopButton
          className={sizeClass[size]}
          label={stopLabel}
          title={stopTitle}
          size={size}
          onClick={onStop}
          spineId={stopSpineId}
        />
      </div>
    )
  }
  return (
    <Button
      size="sm"
      variant={variant}
      className={cn(
        sizeClass[size],
        variant === "outline" && "bg-transparent",
        runButtonClassName,
        className,
      )}
      disabled={disabled}
      title={title}
      onClick={onRun}
      spineId={spineId}
    >
      {idleIcon ?? <Play className={cn(icon, "mr-1.5")} />}
      {label}
    </Button>
  )
}
