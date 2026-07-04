"use client"

// AI : side-by-side expected vs actual when pretty-printed line counts match (one shared scroll);
// AI : otherwise fall back to a unified git-style diff so misaligned lengths stay readable.

import { useMemo } from "react"
import { JsonFieldKindHighlight } from "@/components/highlight"
import { JsonUnifiedDiffView } from "@/components/json-unified-diff-view"
import { ResizableSplit } from "@/components/resizable-split"
import { jsonUnifiedDiff, jsonUnifiedDiffSourceIndexes } from "@/lib/json-diff"
import { differingPrettyLineIndexes } from "@/lib/json-pretty-lines"
import { tryParseJson } from "@/lib/json-utils"
import { cn } from "@/lib/utils"
import type { RunTestDeterministicDiffResult, TolerantFieldPath } from "@/lib/types"

type field_path_string = string
type pixel_width = number

function compareLabel(text: string) {
  return <p className="font-mono text-[10px] uppercase text-muted-foreground">{text}</p>
}

function prettyLineCount(text: string): number {
  if (!text) return 1
  return text.split("\n").length
}

export type ExpectedActualCompareProps = {
  expectedJson: string
  actual: unknown
  probabilisticPaths: field_path_string[]
  probabilisticCheckedPaths?: field_path_string[]
  tolerantPaths?: TolerantFieldPath[]
  expectedLabel?: string
  actualLabel?: string
  compareWidth: pixel_width
  onCompareWidthChange: (width: pixel_width) => void
  onCompareWidthCommit?: (width: pixel_width) => void
  minLeading?: pixel_width
  maxLeading?: pixel_width
  className?: string
  deterministicDiffExplanations?: RunTestDeterministicDiffResult[]
}

export function ExpectedActualCompare({
  expectedJson,
  actual,
  probabilisticPaths,
  probabilisticCheckedPaths,
  tolerantPaths = [],
  expectedLabel = "expected",
  actualLabel = "last run actual",
  compareWidth,
  onCompareWidthChange,
  onCompareWidthCommit,
  minLeading = 180,
  maxLeading = 720,
  className,
  deterministicDiffExplanations,
}: ExpectedActualCompareProps) {
  const actualJson = useMemo(() => JSON.stringify(actual, null, 2) ?? "undefined", [actual])
  const expectedPretty = useMemo(() => {
    const parsed = tryParseJson(expectedJson, { trim: true })
    return parsed.ok ? JSON.stringify(parsed.value, null, 2) : expectedJson
  }, [expectedJson])
  const aligned = useMemo(
    () => prettyLineCount(expectedPretty) === prettyLineCount(actualJson),
    [expectedPretty, actualJson],
  )
  const diff = useMemo(() => {
    const parsed = tryParseJson(expectedJson, { trim: true })
    const expectedValue = parsed.ok ? parsed.value : expectedJson
    return jsonUnifiedDiff(expectedValue, actual)
  }, [expectedJson, actual])
  const expectedLines = useMemo(() => expectedPretty.split("\n"), [expectedPretty])
  const actualLines = useMemo(() => actualJson.split("\n"), [actualJson])
  const mismatchLines = useMemo(
    () => differingPrettyLineIndexes(expectedPretty, actualJson),
    [expectedPretty, actualJson],
  )
  const diffExplanations = useMemo(() => {
    const out = new Map<field_path_string, string>()
    for (const row of deterministicDiffExplanations ?? []) {
      if (row.path && row.reason) out.set(row.path, row.reason)
    }
    return out
  }, [deterministicDiffExplanations])
  const diffSourceIndexes = useMemo(() => {
    const parsed = tryParseJson(expectedJson, { trim: true })
    const expectedValue = parsed.ok ? parsed.value : expectedJson
    return jsonUnifiedDiffSourceIndexes(expectedValue, actual)
  }, [expectedJson, actual])

  const highlightProps = {
    probabilisticPaths,
    probabilisticCheckedPaths,
    tolerantPaths,
    diffExplanations,
  }

  if (!aligned) {
    return (
      <div className={cn("space-y-1", className)}>
        <p className="font-mono text-[10px] text-muted-foreground">
          Line counts differ — unified diff view
        </p>
        {compareLabel(`${expectedLabel} vs ${actualLabel}`)}
        <div className="max-h-80 overflow-auto rounded-md border border-border bg-muted/20 p-2.5">
          <JsonUnifiedDiffView
            diff={diff}
            diffExplanations={diffExplanations}
            expectedPretty={expectedPretty}
            actualPretty={actualJson}
            diffSourceIndexes={diffSourceIndexes}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "max-h-80 overflow-auto rounded-md border border-border bg-muted/20",
        className,
      )}
    >
      <ResizableSplit
        className="w-full"
        leadingWidth={compareWidth}
        onLeadingWidthChange={onCompareWidthChange}
        onLeadingWidthCommit={onCompareWidthCommit}
        minLeading={minLeading}
        maxLeading={maxLeading}
        leading={
          <div className="min-w-0 pr-1">
            <div className="sticky top-0 z-[1] bg-muted/20 px-2.5 pb-1 pt-2.5">{compareLabel(expectedLabel)}</div>
            <div className="px-2.5 pb-2.5">
              <JsonFieldKindHighlight
                json={expectedPretty}
                differingLineIndexes={mismatchLines}
                pairedLines={actualLines}
                {...highlightProps}
              />
            </div>
          </div>
        }
        trailing={
          <div className="min-w-0 pl-1">
            <div className="sticky top-0 z-[1] bg-muted/20 px-2.5 pb-1 pt-2.5">{compareLabel(actualLabel)}</div>
            <div className="px-2.5 pb-2.5">
              <JsonFieldKindHighlight
                json={actualJson}
                differingLineIndexes={mismatchLines}
                pairedLines={expectedLines}
                {...highlightProps}
              />
            </div>
          </div>
        }
      />
    </div>
  )
}
