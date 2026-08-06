"use client"

import type { PromptCacheRegions } from "@/lib/prompt-cache-regions"
import { formatPromptCacheRatio } from "@/lib/prompt-cache-regions"

export function PromptCacheStats({ regions }: { regions: PromptCacheRegions }) {
  const suffixLabel =
    regions.suffixCharsMin === regions.suffixCharsMax
      ? `${regions.suffixCharsMin.toLocaleString()} chars`
      : `${regions.suffixCharsMin.toLocaleString()}–${regions.suffixCharsMax.toLocaleString()} chars`

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
      <span
        className="rounded border border-chart-3/45 bg-chart-3/10 px-1.5 py-0.5 text-chart-3"
        title="Provider prompt-cache prefix — identical bytes across batched LLM calls"
      >
        cached prefix · {regions.prefixChars.toLocaleString()} chars
      </span>
      <span
        className="rounded border border-chart-4/45 bg-chart-4/10 px-1.5 py-0.5 text-chart-4"
        title="Unique suffix — changes per candidate"
      >
        unique suffix · {suffixLabel}
      </span>
      <span className="text-muted-foreground">
        {formatPromptCacheRatio(regions.sharedRatio)} shared · {regions.candidateCount} calls
      </span>
    </div>
  )
}
