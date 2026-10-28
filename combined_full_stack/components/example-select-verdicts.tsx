"use client"

import { useMemo, useState } from "react"
import { IoPager } from "@/components/logging/io-pager"
import type { ExampleSelectVerdict } from "@/lib/example-select-verdicts"
import { cn } from "@/lib/utils"

type ExampleSelectVerdictsSectionProps = {
  verdicts?: ExampleSelectVerdict[]
  className?: string
}

// AI : step trace — full per-candidate relevance path including excluded rows.
export function ExampleSelectVerdictsSection({ verdicts, className }: ExampleSelectVerdictsSectionProps) {
  const [showExcluded, setShowExcluded] = useState(true)

  const kept = useMemo(() => verdicts?.filter((v) => v.is_relevant) ?? [], [verdicts])
  const excluded = useMemo(() => verdicts?.filter((v) => !v.is_relevant) ?? [], [verdicts])
  const visible = showExcluded ? excluded : kept

  if (!verdicts?.length) return null

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
          onClick={() => setShowExcluded((v) => !v)}
        >
          {showExcluded ? "show kept" : "show excluded"}
        </button>
      </div>

      {visible.length > 0 ? (
        <IoPager
          items={visible.map((v) => ({
            label: `${v.candidateLabel} · call ${v.promptIndex + 1}/${verdicts.length}`,
            text: v.chain_of_thought,
          }))}
          renderItem={(_, i) => {
            const current = visible[i]!
            return (
              <p
                className={cn(
                  "font-mono text-[10px] leading-relaxed whitespace-pre-wrap",
                  current.is_relevant ? "text-chart-3" : "text-muted-foreground",
                )}
              >
                <span className="font-semibold">{current.is_relevant ? "INCLUDED" : "EXCLUDED"}:</span>{" "}
                {current.chain_of_thought || "—"}
              </p>
            )
          }}
        />
      ) : null}
    </div>
  )
}
