"use client"

import type { LlmCallRecord } from "@/lib/types"
import {
  buildMetricScatter,
  formatMetric,
  metricAxisLabel,
  type MetricField,
} from "@/lib/llm-distribution"
import { ValueScatterChart } from "@/components/value-scatter-chart"

export function LlmCallDistribution({
  calls,
  compact,
}: {
  calls: LlmCallRecord[]
  compact?: boolean
}) {
  if (calls.length === 0) return null

  const ok = calls.filter((c) => c.status === "ok").length
  const failed = calls.length - ok

  return (
    <div
      className={
        compact
          ? "mt-2 pl-7"
          : "rounded-md border-2 border-border bg-muted/10 p-3"
      }
    >
      {!compact && (
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2">
          <h4 className="font-mono text-[10px] font-medium uppercase tracking-wide text-foreground">
            LLM call distributions
          </h4>
          <span className="font-mono text-[9px] text-muted-foreground">
            <span className="text-[#22c55e]">{ok} ok</span>
            {failed > 0 && (
              <>
                {" · "}
                <span className="text-[#ef4444]">{failed} failed</span>
              </>
            )}
          </span>
        </div>
      )}
      {compact && (
        <p className="mb-2 font-mono text-[10px] text-muted-foreground">
          Call distributions ·{" "}
          <span className="text-[#22c55e]">{ok} ok</span>
          {failed > 0 && (
            <>
              {" · "}
              <span className="text-[#ef4444]">{failed} failed</span>
            </>
          )}
        </p>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:gap-3">
        {(["inputChars", "outputChars", "latencyMs"] as MetricField[]).map((field) => (
          <MetricScatter field={field} calls={calls} key={field} />
        ))}
      </div>
      <p className="mt-2 font-mono text-[9px] text-muted-foreground/70">
        Each dot = one call · green = ok · red = failed · gray = μ ± σ
      </p>
    </div>
  )
}

function MetricScatter({ field, calls }: { field: MetricField; calls: LlmCallRecord[] }) {
  const scatter = buildMetricScatter(calls, field)
  const titles: Record<MetricField, string> = {
    inputChars: "Input (chars)",
    outputChars: "Output (chars)",
    latencyMs: "Response latency",
  }
  return (
    <ValueScatterChart
      title={titles[field]}
      scatter={scatter}
      format={(n) => formatMetric(field, n)}
      axisLabel={metricAxisLabel(field)}
      count={calls.length}
    />
  )
}
