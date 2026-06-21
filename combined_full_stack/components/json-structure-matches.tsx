"use client"

import { useMemo } from "react"
import { LayoutGrid } from "lucide-react"
import { useAppShell } from "@/lib/app-shell"
import { findMatchingStructures } from "@/lib/structure-match"
import { useStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function JsonStructureMatches({
  json,
  className,
}: {
  json: string
  className?: string
}) {
  const { models } = useStore()
  const { openStructure } = useAppShell()

  const { error, matches } = useMemo(() => {
    try {
      const parsed = JSON.parse(json) as unknown
      return { error: null as string | null, matches: findMatchingStructures(parsed, models) }
    } catch (e) {
      return { error: (e as Error).message, matches: [] }
    }
  }, [json, models])

  return (
    <div className={cn("border-b border-border bg-secondary/20 px-4 py-2.5", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Validates as
        </span>
        {error ? (
          <span className="font-mono text-[10px] text-destructive">invalid JSON</span>
        ) : matches.length === 0 ? (
          <span className="font-mono text-[10px] text-muted-foreground">no matching structures</span>
        ) : (
          matches.map((m) => (
            <button
              key={`${m.modelId}:${m.matchKind}`}
              type="button"
              onClick={() => openStructure(m.modelId)}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
              title={`Open ${m.modelName} in Structure tab`}
            >
              <LayoutGrid className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">{m.modelName}</span>
              {m.matchKind === "list" && (
                <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                  list
                </Badge>
              )}
              {m.fieldCount <= 2 && (
                <Badge variant="outline" className="h-4 px-1 font-mono text-[9px] text-muted-foreground">
                  general
                </Badge>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
