"use client"

import { useMemo, useState } from "react"
import type { ExampleSelectVerdict } from "@/lib/example-select-verdicts"
import { cn } from "@/lib/utils"

type ExampleSelectVerdictsSectionProps = {
  verdicts?: ExampleSelectVerdict[]
  className?: string
}

// AI : step trace — full per-candidate relevance path including excluded rows.
export function ExampleSelectVerdictsSection({ verdicts, className }: ExampleSelectVerdictsSectionProps) {
  const [showExcluded, setShowExcluded] = useState(true)
  const [index, setIndex] = useState(0)

  const kept = useMemo(() => verdicts?.filter((v) => v.is_relevant) ?? [], [verdicts])
  const excluded = useMemo(() => verdicts?.filter((v) => !v.is_relevant) ?? [], [verdicts])
  const visible = showExcluded ? excluded : kept

  if (!verdicts?.length) return null

  const current = visible[index]
  const total = visible.length

  return (
    <div className={cn("mt-2 space-y-1.5 rounded-md border border-border bg-muted/10 p-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Relevance verdicts
        </p>
        <span className="font-mono text-[10px] text-chart-3">{kept.length} kept</span>
        <span className="font-mono text-[10px] text-destructive/80">{excluded.length} excluded</span>
        <button
          type="button"
          className="font-mono text-[10px] text-primary underline-offset-2 hover:underline"
          onClick={() => {
            setShowExcluded((v) => !v)
            setIndex(0)
          }}
        >
          {showExcluded ? "show kept" : "show excluded"}
        </button>
      </div>

      {total > 0 && current && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="font-mono text-[10px] text-muted-foreground disabled:opacity-40"
              disabled={index <= 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              ◀
            </button>
            <span className="flex-1 truncate font-mono text-[10px]">
              {current.candidateLabel} · call {current.promptIndex + 1}/{verdicts.length}
            </span>
            <button
              type="button"
              className="font-mono text-[10px] text-muted-foreground disabled:opacity-40"
              disabled={index >= total - 1}
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            >
              ▶
            </button>
          </div>
          <p
            className={cn(
              "font-mono text-[10px] leading-relaxed whitespace-pre-wrap",
              current.is_relevant ? "text-chart-3" : "text-muted-foreground",
            )}
          >
            <span className="font-semibold">{current.is_relevant ? "INCLUDED" : "EXCLUDED"}:</span>{" "}
            {current.chain_of_thought || "—"}
          </p>
        </>
      )}
    </div>
  )
}
