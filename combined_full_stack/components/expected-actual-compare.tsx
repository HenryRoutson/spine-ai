"use client"

// AI : side-by-side expected vs actual when pretty-printed line counts match (one shared scroll);
// AI : otherwise fall back to a unified git-style diff so misaligned lengths stay readable.

import { useMemo } from "react"
import { JsonFieldKindHighlight } from "@/components/highlight"
import { JsonUnifiedDiffView } from "@/components/json-unified-diff-view"
import { ResizableSplit } from "@/components/resizable-split"
import { stablePrettyJson } from "@/lib/deep_equal"
import { jsonUnifiedDiff, jsonUnifiedDiffSourceIndexes } from "@/lib/json-diff"
import { deterministicCompareCores } from "@/lib/testing-files"
import { differingDeterministicPrettyLineIndexes } from "@/lib/json-pretty-lines"
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
  const actualJson = useMemo(
    () => (actual === undefined ? "undefined" : stablePrettyJson(actual)),
    [actual],
  )
  const expectedPretty = useMemo(() => {
    const parsed = tryParseJson(expectedJson, { trim: true })
    return parsed.ok ? stablePrettyJson(parsed.value) : expectedJson
  }, [expectedJson])
  const parsedExpected = useMemo(() => tryParseJson(expectedJson, { trim: true }), [expectedJson])
  const expectedValue = parsedExpected.ok ? parsedExpected.value : expectedJson
  const deterministicCores = useMemo(
    () =>
      parsedExpected.ok && actual !== undefined
        ? deterministicCompareCores(expectedValue, actual, probabilisticPaths)
        : undefined,
    [parsedExpected.ok, expectedValue, actual, probabilisticPaths],
  )
  const aligned = useMemo(() => {
    if (deterministicCores) {
      return (
        prettyLineCount(stablePrettyJson(deterministicCores.expectedCore)) ===
        prettyLineCount(stablePrettyJson(deterministicCores.actualCore))
      )
    }
    return prettyLineCount(expectedPretty) === prettyLineCount(actualJson)
  }, [deterministicCores, expectedPretty, actualJson])
  const diff = useMemo(() => {
    if (deterministicCores) {
      return jsonUnifiedDiff(deterministicCores.expectedCore, deterministicCores.actualCore)
    }
    return jsonUnifiedDiff(expectedValue, actual)
  }, [deterministicCores, expectedValue, actual])
  const expectedLines = useMemo(() => expectedPretty.split("\n"), [expectedPretty])
  const actualLines = useMemo(() => actualJson.split("\n"), [actualJson])
  const mismatchLines = useMemo(
    () =>
      differingDeterministicPrettyLineIndexes(
        expectedValue,
        actual,
        expectedPretty,
        actualJson,
        probabilisticPaths,
        tolerantPaths,
      ),
    [expectedValue, actual, expectedPretty, actualJson, probabilisticPaths, tolerantPaths],
  )
  const deterministicExpectedPretty = useMemo(
    () => (deterministicCores ? stablePrettyJson(deterministicCores.expectedCore) : expectedPretty),
    [deterministicCores, expectedPretty],
  )
  const deterministicActualPretty = useMemo(
    () => (deterministicCores ? stablePrettyJson(deterministicCores.actualCore) : actualJson),
    [deterministicCores, actualJson],
  )
  const diffExplanations = useMemo(() => {
    const out = new Map<field_path_string, string>()
    for (const row of deterministicDiffExplanations ?? []) {
      if (row.path && row.reason) out.set(row.path, row.reason)
    }
    return out
  }, [deterministicDiffExplanations])
  const diffSourceIndexes = useMemo(() => {
    if (deterministicCores) {
      return jsonUnifiedDiffSourceIndexes(deterministicCores.expectedCore, deterministicCores.actualCore)
    }
    return jsonUnifiedDiffSourceIndexes(expectedValue, actual)
  }, [deterministicCores, expectedValue, actual])

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
            expectedPretty={deterministicExpectedPretty}
            actualPretty={deterministicActualPretty}
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
