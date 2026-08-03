"use client"

import {
  FileInput,
  FileOutput,
  FileText,
  Scissors,
  Layers,
  Merge,
  Shuffle,
  Sparkle,
  Code2,
  Link2,
  Lock,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MODULE_META, type ModuleKind, type RunStepKind } from "@/lib/types"

// AI : batch llm is a 2×2 sparkle grid so it reads as "many calls" vs single Sparkle.
export function BatchSparkleIcon({ className }: { className?: string }) {
  // AI : explicit size-* on each svg so parent menus can't force size-4 on lucide children.
  const sparkle = "size-[calc(50%-1px)] shrink-0"
  return (
    <span
      className={cn(
        "inline-grid shrink-0 grid-cols-2 place-items-center gap-px leading-none",
        className,
      )}
    >
      <Sparkle className={sparkle} />
      <Sparkle className={sparkle} />
      <Sparkle className={sparkle} />
      <Sparkle className={sparkle} />
    </span>
  )
}

export type ModuleIcon = LucideIcon | typeof BatchSparkleIcon

export const KIND_ICON: Record<ModuleKind, ModuleIcon> = {
  input: FileInput,
  llm: Sparkle,
  "llm-batch": BatchSparkleIcon,
  quote: Link2,
  transform: Shuffle,
  chunk: Scissors,
  "merge": Layers,
  combine: Merge,
  "custom-code": Code2,
  assert: ShieldCheck,
  "human-review": UserCheck,
  output: FileOutput,
}

export const KIND_COLOR: Record<ModuleKind, string> = {
  input: "text-chart-2",
  llm: "text-primary",
  "llm-batch": "text-primary",
  quote: "text-chart-2",
  transform: "text-chart-3",
  chunk: "text-chart-1",
  "merge": "text-chart-1",
  combine: "text-chart-3",
  "custom-code": "text-chart-1",
  assert: "text-chart-2",
  "human-review": "text-chart-1",
  output: "text-output",
}

// AI : bordered icon chip per step kind — used in insert-step menus and similar pickers.
export const KIND_SURFACE: Record<ModuleKind, string> = {
  input: "border-chart-2/40 bg-chart-2/10",
  llm: "border-primary/40 bg-primary/10",
  "llm-batch": "border-primary/40 bg-primary/10",
  quote: "border-chart-2/40 bg-chart-2/10",
  transform: "border-chart-3/40 bg-chart-3/10",
  chunk: "border-chart-1/40 bg-chart-1/10",
  merge: "border-chart-1/40 bg-chart-1/10",
  combine: "border-chart-3/40 bg-chart-3/10",
  "custom-code": "border-chart-1/40 bg-chart-1/10",
  assert: "border-chart-2/40 bg-chart-2/10",
  "human-review": "border-chart-1/40 bg-chart-1/10",
  output: "border-output/40 bg-output/10",
}

export function KindMenuItemIcon({ kind }: { kind: ModuleKind }) {
  const Icon = KIND_ICON[kind]
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
        KIND_SURFACE[kind],
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", KIND_COLOR[kind])} />
    </span>
  )
}

const LEGACY_KIND_ICON: Partial<Record<RunStepKind, ModuleIcon>> = {
  "doc-to-text": FileText,
}

export function stepKindIcon(kind: RunStepKind): ModuleIcon {
  return KIND_ICON[kind as ModuleKind] ?? LEGACY_KIND_ICON[kind] ?? FileInput
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

export function AutoStructureParseLock({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border border-chart-3/40 bg-chart-3/10 px-1.5 py-0.5 text-chart-3",
        className,
      )}
    >
      <Lock className="h-3 w-3" />
      <span className="font-mono text-[9px]">auto</span>
    </span>
  )
}
