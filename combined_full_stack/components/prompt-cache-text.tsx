"use client"

import { PromptText } from "@/components/highlight"
import { cn } from "@/lib/utils"
import type { DocId } from "@/lib/types"

type PromptCacheTextProps = {
  text: string
  prefixLen?: number
  sourceDocId?: DocId
  className?: string
}

// AI : two-tone prompt — green prefix (cache hit) + amber suffix (per-candidate tail).
export function PromptCacheText({ text, prefixLen, sourceDocId, className }: PromptCacheTextProps) {
  const split =
    prefixLen != null && prefixLen > 0 && prefixLen < text.length ? prefixLen : undefined

  if (split == null) {
    return (
      <div className={className}>
        <PromptText text={text} sourceDocId={sourceDocId} />
      </div>
    )
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div
        className="rounded-sm border-l-2 border-chart-3/55 bg-chart-3/8 pl-1.5"
        title="Cached prefix — identical across batched LLM calls"
      >
        <PromptText text={text.slice(0, split)} sourceDocId={sourceDocId} />
      </div>
      <div
        className="rounded-sm border-l-2 border-chart-4/55 bg-chart-4/8 pl-1.5"
        title="Unique suffix — changes per candidate"
      >
        <PromptText text={text.slice(split)} sourceDocId={sourceDocId} />
      </div>
    </div>
  )
}
