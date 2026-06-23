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
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ModuleKind } from "@/lib/types"

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
  output: "text-chart-4",
}
