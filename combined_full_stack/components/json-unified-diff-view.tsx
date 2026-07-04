"use client"

// AI : git-style unified JSON diff — green additions, red removals.

import { useMemo } from "react"
import { InlineJsonTokens } from "@/components/highlight"
import { assignPathsToPrettyLines } from "@/lib/json-pretty-lines"
import { cn } from "@/lib/utils"

type field_path_string = string

export function JsonUnifiedDiffView({
  diff,
  diffExplanations,
  expectedPretty,
  actualPretty,
  diffSourceIndexes,
}: {
  diff: string
  diffExplanations?: ReadonlyMap<field_path_string, string>
  expectedPretty?: string
  actualPretty?: string
  // AI : when set, overrides path lookup from expectedPretty/actualPretty (same order as diff rows).
  diffSourceIndexes?: ReadonlyArray<number | undefined>
}) {
  const pathBySourceLine = useMemo(() => {
    if (!expectedPretty && !actualPretty) return undefined
    const expectedPaths = expectedPretty ? assignPathsToPrettyLines(expectedPretty.split("\n")) : []
    const actualPaths = actualPretty ? assignPathsToPrettyLines(actualPretty.split("\n")) : []
    const n = Math.max(expectedPaths.length, actualPaths.length)
    const out: (field_path_string | undefined)[] = []
    for (let i = 0; i < n; i++) out.push(expectedPaths[i] ?? actualPaths[i])
    return out
  }, [expectedPretty, actualPretty])

  const diffLines = diff.split("\n")

  return (
    <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed">
      <code>
        {diffLines.map((line, i) => {
          const prefix = line.charAt(0)
          const body = line.slice(1)
          const added = prefix === "+"
          const removed = prefix === "-"
          const sourceIndex = diffSourceIndexes?.[i]
          const path =
            sourceIndex !== undefined && pathBySourceLine ? pathBySourceLine[sourceIndex] : undefined
          const explanation = path ? diffExplanations?.get(path) : undefined
          return (
            <div
              key={i}
              className={cn(
                "whitespace-pre",
                added && "bg-chart-1/15 text-chart-1",
                removed && "bg-destructive/15 text-destructive",
                !added && !removed && "text-muted-foreground",
              )}
            >
              <span>{prefix}</span>
              {added || removed ? body : <InlineJsonTokens text={body} />}
              {explanation && (added || removed) && (
                <span className="text-destructive/80">{` // because: ${explanation}`}</span>
              )}
            </div>
          )
        })}
      </code>
    </pre>
  )
}
