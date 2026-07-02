"use client"

import type { LlmCallRecord } from "@/lib/types"
import { failureKindLabel } from "@/lib/llm-distribution"
import { buildLlmRetryGrid, type LlmRetryGridCell } from "@/lib/llm-retry-grid"
import { useStatusPalette } from "@/lib/chart-colors"
import { cn } from "@/lib/utils"

function cellTitle(cell: LlmRetryGridCell, round: number): string {
  if (cell.status === "empty") return `Attempt ${round + 1}: no call recorded`
  const call = cell.call
  const parts = [`Attempt ${round + 1}: ${cell.status}`]
  if (call?.failureKind) parts.push(failureKindLabel(call.failureKind))
  if (call?.failureDetail) parts.push(call.failureDetail.slice(0, 200))
  if (call?.httpStatus) parts.push(`HTTP ${call.httpStatus}`)
  if (call?.latencyMs) parts.push(`${call.latencyMs}ms`)
  return parts.join(" · ")
}

function Cell({
  cell,
  round,
  palette,
}: {
  cell: LlmRetryGridCell
  round: number
  palette: ReturnType<typeof useStatusPalette>
}) {
  const bg =
    cell.status === "ok"
      ? palette.ok
      : cell.status === "retried"
        ? palette.retry
        : cell.status === "error"
          ? palette.err
          : undefined

  return (
    <td className="p-0.5">
      <div
        title={cellTitle(cell, round)}
        className={cn(
          "mx-auto h-4 w-4 rounded-sm border border-border/60",
          cell.status === "empty" && "bg-muted/30",
        )}
        style={bg ? { backgroundColor: `${bg}cc` } : undefined}
      />
    </td>
  )
}

export function LlmRetryGridSection({
  calls,
  stepSucceeded,
  promptCountHint,
  className,
}: {
  calls: LlmCallRecord[]
  stepSucceeded: boolean
  promptCountHint?: number
  className?: string
}) {
  const palette = useStatusPalette()
  const grid = buildLlmRetryGrid(calls, stepSucceeded, promptCountHint)
  if (!grid) return null

  const { promptCount, columnCount, cells } = grid
  const showRowLabels = promptCount > 1

  return (
    <div className={cn("mt-2 rounded border border-border bg-muted/15 p-2", className)}>
      <p className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Attempt grid ({promptCount} prompt{promptCount === 1 ? "" : "s"} × {columnCount} attempt
        {columnCount === 1 ? "" : "s"})
      </p>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              {showRowLabels && <th className="w-8" />}
              {Array.from({ length: columnCount }, (_, round) => (
                <th
                  key={round}
                  className="px-1 pb-1 text-center font-mono text-[9px] font-normal text-muted-foreground"
                >
                  {round === 0 ? "1st" : round === 1 ? "retry" : `r${round}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.map((row, pi) => (
              <tr key={pi}>
                {showRowLabels && (
                  <td className="pr-1.5 font-mono text-[9px] text-muted-foreground">p{pi + 1}</td>
                )}
                {row.map((cell, ri) => (
                  <Cell key={ri} cell={cell} round={ri} palette={palette} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 font-mono text-[9px] text-muted-foreground/80">
        Green = ok · amber = failed then recovered · red = failed · hover for detail
      </p>
    </div>
  )
}
