"use client"

import type { ComponentType } from "react"
import {
  AlertTriangle,
  Braces,
  Boxes,
  Crosshair,
  FileText,
  Layers,
  Quote,
  Workflow,
  X,
} from "lucide-react"
import type { UiContextKind, UiContextRef } from "@/lib/ui-context-types"
import { cn } from "@/lib/utils"

const KIND_ICON: Record<UiContextKind, ComponentType<{ className?: string }>> = {
  pipeline_step: Workflow,
  inspector_field: Crosshair,
  invalid_issue: AlertTriangle,
  run_error: AlertTriangle,
  prompt_cache: Layers,
  generic: Crosshair,
  project_doc: FileText,
  model: Boxes,
  type_alias: Braces,
  chat_quote: Quote,
}

type UiContextChipProps = {
  pin: UiContextRef
  onRemove?: (id: string) => void
  className?: string
}

export function UiContextChip({ pin, onRemove, className }: UiContextChipProps) {
  const Icon = KIND_ICON[pin.kind] ?? Crosshair
  const tone =
    pin.kind === "invalid_issue" || pin.kind === "run_error"
      ? "border-destructive/40 bg-destructive/10"
      : pin.kind === "project_doc"
        ? "border-amber-400/40 bg-amber-500/10"
        : pin.kind === "chat_quote"
          ? "border-violet-400/40 bg-violet-500/10"
          : "border-sky-400/50 bg-sky-500/15"

  return (
    <span
      data-slot="ui-context-chip"
      data-kind={pin.kind}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] text-foreground shadow-sm",
        tone,
        className,
      )}
      title={pin.snippet ?? pin.label}
    >
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">{pin.label}</span>
      {onRemove ? (
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background/70 hover:text-foreground"
          onClick={() => onRemove(pin.id)}
          aria-label={`Remove ${pin.label}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  )
}
