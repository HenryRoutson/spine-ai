"use client"

// AI : git-style unified JSON diff — green additions, red removals.

import { InlineJsonTokens } from "@/components/highlight"
import { cn } from "@/lib/utils"

export function JsonUnifiedDiffView({ diff }: { diff: string }) {
  return (
    <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed">
      <code>
        {diff.split("\n").map((line, i) => {
          const prefix = line.charAt(0)
          const body = line.slice(1)
          const added = prefix === "+"
          const removed = prefix === "-"
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
            </div>
          )
        })}
      </code>
    </pre>
  )
}
