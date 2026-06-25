"use client"

import type { RunFailureRecord, RunStep } from "@/lib/types"
import { failureKindLabel, stepFailures } from "@/lib/llm-distribution"
import { CHART_ERR_TEXT_CLASS, CHART_RETRY_TEXT_CLASS } from "@/lib/chart-colors"
import { cn } from "@/lib/utils"

export function StepFailuresSection({
  step,
  className,
}: {
  step: RunStep
  className?: string
}) {
  const failures = stepFailures(step)
  if (!failures.length) return null

  return (
    <div className={cn("mt-2 rounded border border-border bg-muted/15 p-2", className)}>
      <p className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Failures ({failures.length})
      </p>
      <ul className="space-y-1.5">
        {failures.map((failure, i) => (
          <FailureRow failure={failure} key={i} />
        ))}
      </ul>
    </div>
  )
}

function FailureRow({ failure }: { failure: RunFailureRecord }) {
  const statusClass = failure.recovered ? CHART_RETRY_TEXT_CLASS : CHART_ERR_TEXT_CLASS
  const statusLabel = failure.recovered ? "recovered" : "failed"

  return (
    <li className="font-mono text-[10px] leading-snug">
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className={statusClass}>{failureKindLabel(failure.kind)}</span>
        {failure.attempt != null && (
          <span className="text-muted-foreground">· attempt {failure.attempt}</span>
        )}
        <span className={statusClass}>· {statusLabel}</span>
      </div>
      {failure.detail && (
        <p className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground/90">{failure.detail}</p>
      )}
    </li>
  )
}
