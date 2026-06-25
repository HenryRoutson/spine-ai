"use client"

import {
  FileInput,
  FileOutput,
  FileText,
  Merge,
  Shuffle,
  Sparkle,
  Code2,
  Link2,
  Lock,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MODULE_META, type ModuleKind } from "@/lib/types"

// AI : batch llm is a 2×2 sparkle grid so it reads as "many calls" vs single Sparkle.
export function BatchSparkleIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid grid-cols-2 gap-px leading-none [&_svg]:size-[42%]",
        className,
      )}
    >
      <Sparkle />
      <Sparkle />
      <Sparkle />
      <Sparkle />
    </span>
  )
}

export type ModuleIcon = LucideIcon | typeof BatchSparkleIcon

export const KIND_ICON: Record<ModuleKind, ModuleIcon> = {
  input: FileInput,
  "doc-to-text": FileText,
  llm: Sparkle,
  "llm-batch": BatchSparkleIcon,
  quote: Link2,
  transform: Shuffle,
  combine: Merge,
  "custom-code": Code2,
  output: FileOutput,
}

export const KIND_COLOR: Record<ModuleKind, string> = {
  input: "text-chart-2",
  "doc-to-text": "text-chart-3",
  llm: "text-primary",
  "llm-batch": "text-primary",
  quote: "text-chart-2",
  transform: "text-chart-3",
  combine: "text-chart-3",
  "custom-code": "text-chart-1",
  output: "text-output",
}

export function KindIcon({ kind, size = "md" }: { kind: ModuleKind; size?: "sm" | "md" }) {
  const Icon = KIND_ICON[kind]
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-0.5">
      <Icon className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", KIND_COLOR[kind])} />
      <span className="text-center text-[8px] leading-tight text-muted-foreground">
        {MODULE_META[kind].label}
      </span>
    </div>
  )
}

export function PipelineNode({ label, subtle }: { label: string; subtle?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider",
        subtle ? "border-border text-muted-foreground" : "border-primary text-primary",
      )}
    >
      {label}
    </div>
  )
}

export function PipelineConnector({ invalid }: { invalid?: boolean }) {
  return (
    <div className="flex h-8 w-full items-center justify-center">
      <div className={cn("h-full w-px", invalid ? "bg-destructive" : "bg-border")} />
    </div>
  )
}

export function AutoQuoteLock({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border border-chart-2/40 bg-chart-2/10 px-1.5 py-0.5 text-chart-2",
        className,
      )}
    >
      <Lock className="h-3 w-3" />
      <span className="font-mono text-[9px]">auto</span>
    </span>
  )
}
