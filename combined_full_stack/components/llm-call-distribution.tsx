"use client"

import type { LlmCallRecord } from "@/lib/types"
import {
  buildValueScatter,
  failureKindLabel,
  formatMetric,
  metricAxisLabel,
  summarizeLlmCalls,
  type LlmCallDisplayStatus,
  type MetricField,
} from "@/lib/llm-distribution"
import {
  CHART_ERR_TEXT_CLASS,
  CHART_OK_TEXT_CLASS,
  CHART_RETRY_TEXT_CLASS,
} from "@/lib/chart-colors"
import { ValueScatterChart } from "@/components/value-scatter-chart"

function LlmCallSummaryLine({ summary }: { summary: ReturnType<typeof summarizeLlmCalls> }) {
  return (
    <>
      <span className={CHART_OK_TEXT_CLASS}>{summary.ok} ok</span>
      {summary.retried > 0 && (
        <>
          {" · "}
          <span className={CHART_RETRY_TEXT_CLASS}>
            {summary.retried} retried (recovered)
          </span>
        </>
      )}
      {summary.failed > 0 && (
        <>
          {" · "}
          <span className={CHART_ERR_TEXT_CLASS}>{summary.failed} failed</span>
        </>
      )}
    </>
  )
}

export function LlmCallDistribution({
  calls,
  callGroups,
  compact,
  stepSucceeded = true,
}: {
  calls?: LlmCallRecord[]
  callGroups?: { calls: LlmCallRecord[]; stepSucceeded: boolean }[]
  compact?: boolean
  stepSucceeded?: boolean
}) {
  const groups =
    callGroups ??
    (calls && calls.length > 0 ? [{ calls, stepSucceeded }] : [])
  if (groups.length === 0) return null

  const flatCalls = groups.flatMap((g) => g.calls)
  const summary = groups.reduce(
    (acc, g) => {
      const s = summarizeLlmCalls(g.calls, g.stepSucceeded)
      return {
        ok: acc.ok + s.ok,
        retried: acc.retried + s.retried,
        failed: acc.failed + s.failed,
        displayStatuses: [...acc.displayStatuses, ...s.displayStatuses],
      }
    },
    { ok: 0, retried: 0, failed: 0, displayStatuses: [] as LlmCallDisplayStatus[] },
  )

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
            <LlmCallSummaryLine summary={summary} />
          </span>
        </div>
      )}
      {compact && (
        <p className="mb-2 font-mono text-[10px] text-muted-foreground">
          Call distributions · <LlmCallSummaryLine summary={summary} />
        </p>
      )}
      {summary.retried > 0 && (
        <p className="mb-2 font-mono text-[9px] text-muted-foreground">
          {describeRecoveredFailures(flatCalls, summary.displayStatuses)}
        </p>
      )}
      {summary.failed > 0 && groups.some((g) => !g.stepSucceeded) && (
        <p className="mb-2 font-mono text-[9px] text-destructive/90">
          {summary.failed === 1
            ? "One LLM request failed with no successful retry — this step errored."
            : `${summary.failed} LLM requests failed with no successful retry — this step errored.`}
        </p>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:gap-3">
        {(["inputChars", "outputChars", "latencyMs"] as MetricField[]).map((field) => (
          <MetricScatter
            field={field}
            calls={flatCalls}
            displayStatuses={summary.displayStatuses}
            key={field}
          />
        ))}
      </div>
      <p className="mt-2 font-mono text-[9px] text-muted-foreground/70">
        Each dot = one HTTP attempt · green = ok · amber = retried (recovered) · red = failed · gray = μ ± σ
      </p>
    </div>
  )
}

function describeRecoveredFailures(
  calls: LlmCallRecord[],
  displayStatuses: LlmCallDisplayStatus[],
): string {
  const recovered = calls
    .map((call, i) => ({ call, display: displayStatuses[i] }))
    .filter(({ call, display }) => display === "retried" && call.failureKind)
  if (!recovered.length) {
    const n = displayStatuses.filter((s) => s === "retried").length
    return n === 1
      ? "One request failed and was automatically retried — the step still succeeded."
      : `${n} requests failed and were automatically retried — the step still succeeded.`
  }
  const labels = [...new Set(recovered.map(({ call }) => failureKindLabel(call.failureKind!)))]
  const noun = recovered.length === 1 ? "failure" : "failures"
  const verb = recovered.length === 1 ? "was" : "were"
  return `${recovered.length} ${noun} (${labels.join(", ")}) ${verb} automatically retried — the step still succeeded.`
}

function MetricScatter({
  field,
  calls,
  displayStatuses,
}: {
  field: MetricField
  calls: LlmCallRecord[]
  displayStatuses: LlmCallDisplayStatus[]
}) {
  const scatter = buildValueScatter(
    calls.map((call, i) => ({ value: call[field], status: displayStatuses[i] })),
  )
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
