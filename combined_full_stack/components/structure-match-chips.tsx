"use client"

import { useEffect } from "react"
import { LayoutGrid } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { StructureMatch } from "@/lib/structure-match"
import type { StructureModelId } from "@/lib/types"

export const STRUCTURE_MATCH_CHIP_CLASS =
  "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] text-foreground"

export function StructureMatchChips({
  matches,
  onOpenStructure,
  error,
  expectMatches = false,
  showGeneralBadge = false,
  label = "Validates as",
}: {
  matches: StructureMatch[]
  onOpenStructure?: (modelId: StructureModelId) => void
  error?: string | null
  expectMatches?: boolean
  showGeneralBadge?: boolean
  label?: string
}) {
  useEffect(() => {
    if (!error && expectMatches && matches.length === 0) {
      console.assert(false, "Validates as: no matching structures — auto-sync should have created one")
    }
  }, [matches, error, expectMatches])

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {error ? (
        <span className="font-mono text-[10px] text-destructive">invalid JSON</span>
      ) : matches.length === 0 ? (
        expectMatches ? null : (
          <span className="font-mono text-[10px] text-muted-foreground">no matching structures</span>
        )
      ) : (
        matches.map((m) => {
          const chipLabel = (
            <>
              <LayoutGrid className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">{m.modelName}</span>
              {m.matchKind === "list" && (
                <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                  list
                </Badge>
              )}
              {showGeneralBadge && m.fieldCount <= 2 && (
                <Badge variant="outline" className="h-4 px-1 font-mono text-[9px] text-muted-foreground">
                  general
                </Badge>
              )}
            </>
          )
          return onOpenStructure ? (
            <button
              key={`${m.modelId}:${m.matchKind}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenStructure(m.modelId)
              }}
              className={cn(
                STRUCTURE_MATCH_CHIP_CLASS,
                "transition-colors hover:border-primary/40 hover:bg-primary/5",
              )}
              title={`Open ${m.modelName} in Structure tab`}
            >
              {chipLabel}
            </button>
          ) : (
            <span key={`${m.modelId}:${m.matchKind}`} className={STRUCTURE_MATCH_CHIP_CLASS} title={m.modelName}>
              {chipLabel}
            </span>
          )
        })
      )}
    </div>
  )
}
