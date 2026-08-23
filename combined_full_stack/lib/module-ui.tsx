"use client"

import {
  FileInput,
  FileOutput,
  FileText,
  Scissors,
  Layers,
  ListFilter,
  Merge,
  Shuffle,
  Sparkle,
  GitBranch,
  GitFork,
  Code2,
  Link2,
  Lock,
  ShieldCheck,
  UserCheck,
  Webhook,
  Puzzle,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MODULE_META, ModuleKind, type RunStepKind } from "@/lib/types"

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
  [ModuleKind.Input]: FileInput,
  [ModuleKind.Llm]: Sparkle,
  [ModuleKind.LlmBatch]: BatchSparkleIcon,
  [ModuleKind.ExampleSelect]: ListFilter,
  [ModuleKind.Quote]: Link2,
  [ModuleKind.DocToText]: FileText,
  [ModuleKind.Transform]: Shuffle,
  [ModuleKind.Chunk]: Scissors,
  [ModuleKind.Merge]: Layers,
  [ModuleKind.Assemble]: Layers,
  [ModuleKind.Parallel]: GitBranch,
  [ModuleKind.Fork]: GitFork,
  [ModuleKind.Combine]: Merge,
  [ModuleKind.CustomCode]: Code2,
  [ModuleKind.Assert]: ShieldCheck,
  [ModuleKind.HumanReview]: UserCheck,
  [ModuleKind.Webhook]: Webhook,
  [ModuleKind.N8n]: Puzzle,
  [ModuleKind.Chatbot]: MessagesSquare,
  [ModuleKind.Output]: FileOutput,
}

export const KIND_COLOR: Record<ModuleKind, string> = {
  [ModuleKind.Input]: "text-chart-2",
  [ModuleKind.Llm]: "text-primary",
  [ModuleKind.LlmBatch]: "text-primary",
  [ModuleKind.ExampleSelect]: "text-chart-3",
  [ModuleKind.Quote]: "text-chart-2",
  [ModuleKind.DocToText]: "text-chart-3",
  [ModuleKind.Transform]: "text-chart-3",
  [ModuleKind.Chunk]: "text-chart-1",
  [ModuleKind.Merge]: "text-chart-1",
  [ModuleKind.Assemble]: "text-chart-3",
  [ModuleKind.Parallel]: "text-primary",
  [ModuleKind.Fork]: "text-chart-4",
  [ModuleKind.Combine]: "text-chart-3",
  [ModuleKind.CustomCode]: "text-chart-1",
  [ModuleKind.Assert]: "text-chart-2",
  [ModuleKind.HumanReview]: "text-chart-1",
  [ModuleKind.Webhook]: "text-chart-4",
  [ModuleKind.N8n]: "text-chart-4",
  [ModuleKind.Chatbot]: "text-chart-2",
  [ModuleKind.Output]: "text-output",
}

// AI : bordered icon chip per step kind — used in insert-step menus and similar pickers.
export const KIND_SURFACE: Record<ModuleKind, string> = {
  [ModuleKind.Input]: "border-chart-2/40 bg-chart-2/10",
  [ModuleKind.Llm]: "border-primary/40 bg-primary/10",
  [ModuleKind.LlmBatch]: "border-primary/40 bg-primary/10",
  [ModuleKind.ExampleSelect]: "border-chart-3/40 bg-chart-3/10",
  [ModuleKind.Quote]: "border-chart-2/40 bg-chart-2/10",
  [ModuleKind.DocToText]: "border-chart-3/40 bg-chart-3/10",
  [ModuleKind.Transform]: "border-chart-3/40 bg-chart-3/10",
  [ModuleKind.Chunk]: "border-chart-1/40 bg-chart-1/10",
  [ModuleKind.Merge]: "border-chart-1/40 bg-chart-1/10",
  [ModuleKind.Assemble]: "border-chart-3/40 bg-chart-3/10",
  [ModuleKind.Parallel]: "border-primary/40 bg-primary/10",
  [ModuleKind.Fork]: "border-chart-4/40 bg-chart-4/10",
  [ModuleKind.Combine]: "border-chart-3/40 bg-chart-3/10",
  [ModuleKind.CustomCode]: "border-chart-1/40 bg-chart-1/10",
  [ModuleKind.Assert]: "border-chart-2/40 bg-chart-2/10",
  [ModuleKind.HumanReview]: "border-chart-1/40 bg-chart-1/10",
  [ModuleKind.Webhook]: "border-chart-4/40 bg-chart-4/10",
  [ModuleKind.N8n]: "border-chart-4/40 bg-chart-4/10",
  [ModuleKind.Chatbot]: "border-chart-2/40 bg-chart-2/10",
  [ModuleKind.Output]: "border-output/40 bg-output/10",
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

export function stepKindIcon(kind: RunStepKind): ModuleIcon {
  return KIND_ICON[kind as ModuleKind] ?? FileInput
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

function AutoLockBadge({ className, tone }: { className?: string; tone: "quote" | "managed" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5",
        tone === "quote"
          ? "border-chart-2/40 bg-chart-2/10 text-chart-2"
          : "border-chart-3/40 bg-chart-3/10 text-chart-3",
        className,
      )}
    >
      <Lock className="h-3 w-3" />
      <span className="font-mono text-[9px]">auto</span>
    </span>
  )
}

export function AutoQuoteLock({ className }: { className?: string }) {
  return <AutoLockBadge tone="quote" className={className} />
}

export function AutoStructureParseLock({ className }: { className?: string }) {
  return <AutoLockBadge tone="managed" className={className} />
}

export const AutoDocToTextLock = AutoStructureParseLock
