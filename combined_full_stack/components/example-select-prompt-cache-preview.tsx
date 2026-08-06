"use client"

import { useMemo } from "react"
import { JsonHighlight } from "@/components/highlight"
import { PromptCacheStats } from "@/components/prompt-cache-stats"
import { exampleSelectRelevanceSchemaJson } from "@/lib/example-select-relevance"
import {
  exampleSelectDesignTimeCacheRegions,
  exampleSelectPromptSegmentLabel,
  parseExampleSelectPromptSegments,
  type ExampleSelectPromptSegmentRole,
} from "@/lib/example-select-prompt-preview"
import { cn } from "@/lib/utils"

const SEGMENT_CLASS: Record<ExampleSelectPromptSegmentRole, string> = {
  cached: "border-l-2 border-chart-3/55 bg-chart-3/8",
  per_run: "border-l-2 border-sky-500/50 bg-sky-500/8",
  per_candidate: "border-l-2 border-chart-4/55 bg-chart-4/8",
}

function SegmentLegend({ role }: { role: ExampleSelectPromptSegmentRole }) {
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 font-mono text-[10px]",
        role === "cached" && "border-chart-3/45 text-chart-3",
        role === "per_run" && "border-sky-500/45 text-sky-600 dark:text-sky-400",
        role === "per_candidate" && "border-chart-4/45 text-chart-4",
      )}
    >
      {exampleSelectPromptSegmentLabel(role)}
    </span>
  )
}

type ExampleSelectPromptCachePreviewProps = {
  template: string
  className?: string
}

// AI : pipeline builder — shows which prompt regions cache vs change before any run.
export function ExampleSelectPromptCachePreview({
  template,
  className,
}: ExampleSelectPromptCachePreviewProps) {
  const segments = useMemo(() => parseExampleSelectPromptSegments(template), [template])
  const regions = useMemo(() => exampleSelectDesignTimeCacheRegions(template), [template])
  const schemaJson = useMemo(() => exampleSelectRelevanceSchemaJson(), [])

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <SegmentLegend role="cached" />
        <SegmentLegend role="per_run" />
        <SegmentLegend role="per_candidate" />
      </div>

      {regions && <PromptCacheStats regions={regions} />}

      <div className="rounded-md border border-border bg-muted/15 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
        {segments.map((seg, i) => {
          if (seg.label === "JSON Schema") {
            return (
              <div
                key={i}
                className={cn("mb-1 rounded-sm pl-1.5", SEGMENT_CLASS.cached)}
                title="Identical on every relevance call"
              >
                <span className="mb-0.5 block text-[9px] uppercase tracking-wide text-chart-3">
                  JSON Schema · cached prefix
                </span>
                Respond with ONLY a JSON value that validates against this JSON Schema:
                <div className="my-1 block rounded border border-border bg-[oklch(0.14_0.004_264)] p-1.5">
                  <JsonHighlight json={schemaJson} />
                </div>
              </div>
            )
          }

          const title =
            seg.role === "per_run"
              ? "Filled from context step — same for every candidate in a run"
              : seg.role === "per_candidate"
                ? "One library row per call — only this tail changes between candidates"
                : "Static template text — cached prefix"

          return (
            <span
              key={i}
              className={cn("inline rounded-sm pl-1", SEGMENT_CLASS[seg.role])}
              title={title}
            >
              {seg.label ? (
                <span
                  className={cn(
                    "rounded px-0.5 font-semibold",
                    seg.role === "per_run" && "text-sky-600 dark:text-sky-400",
                    seg.role === "per_candidate" && "text-chart-4",
                  )}
                >
                  {seg.text}
                </span>
              ) : (
                seg.text
              )}
            </span>
          )
        })}
      </div>

      <p className="font-mono text-[10px] text-muted-foreground">
        Sample damage case + 2 library rows — flip candidates in Logging after a run; only the{" "}
        <span className="text-chart-4">{`{example}`}</span> block should change.
      </p>
    </div>
  )
}
