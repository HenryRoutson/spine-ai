"use client"

import { useMemo } from "react"
import { Sparkles, Plus } from "lucide-react"
import { useAppShell } from "@/lib/app-shell"
import { inferStructuresFromDocContent, type DerivedDocStructure } from "@/lib/doc-structure-infer"
import {
  alreadyAdded,
  openOrAddDerivedStructure,
} from "@/lib/doc-derived-structures"
import { parseAndMatchStructures } from "@/lib/structure-match-parse"
import { tabularRowSetsFromContent } from "@/lib/tabular-row-sets"
import { useDocText } from "@/lib/use-doc-text"
import { useStore, uid } from "@/lib/store"
import { StructureMatchChips, STRUCTURE_MATCH_CHIP_CLASS } from "@/components/structure-match-chips"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DocRef, StructureModelId } from "@/lib/types"

export function DocDerivedStructures({
  doc,
  compact = false,
}: {
  doc: DocRef
  compact?: boolean
}) {
  const { models, setModels } = useStore()
  const { openStructure } = useAppShell()
  const { content, loading } = useDocText(doc.id)

  const derived = useMemo(() => {
    if (!content) return []
    const rowSets = tabularRowSetsFromContent(content, doc.name, doc.type)
    return inferStructuresFromDocContent(content, doc.name, doc.type, () => uid<StructureModelId>(), rowSets)
  }, [content, doc.name, doc.type])

  const { matches } = useMemo(
    () => (content?.trim() ? parseAndMatchStructures(content, models) : { matches: [], error: null }),
    [content, models],
  )

  function addStructure(d: DerivedDocStructure) {
    openOrAddDerivedStructure(d, doc.id, models, () => uid<StructureModelId>(), setModels, openStructure)
  }

  if (loading) {
    return (
      <p className="font-mono text-[10px] text-muted-foreground">
        {compact ? "…" : "Loading structure preview…"}
      </p>
    )
  }

  if (!derived.length && !matches.length) return null

  return (
    <div className={cn("space-y-2", compact ? "mt-1.5" : "mt-2 rounded-md border border-border bg-secondary/20 px-3 py-2")}>
      {matches.length > 0 && (
        <StructureMatchChips
          matches={matches}
          onOpenStructure={(modelId) => openStructure(modelId)}
        />
      )}

      {derived.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Derived
          </span>
          {derived.map((d) => {
            const added = alreadyAdded(models, doc.id, d.model.name)
            return (
              <button
                key={`${d.model.name}:${d.sheetName ?? "main"}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  addStructure(d)
                }}
                className={cn(
                  STRUCTURE_MATCH_CHIP_CLASS,
                  added
                    ? "border-chart-3/40 bg-chart-3/5"
                    : "transition-colors hover:border-primary/40 hover:bg-primary/5",
                )}
                title={
                  added
                    ? `Open ${d.model.name} in Structure tab`
                    : `Add ${d.model.name} to project structures`
                }
              >
                <Sparkles className="h-3 w-3 shrink-0 text-chart-3" />
                <span className="truncate">{d.model.name}</span>
                <span className="text-muted-foreground">{d.model.fields.length}f</span>
                {d.matchKind === "list" && (
                  <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                    list
                  </Badge>
                )}
                {d.sheetName && (
                  <Badge variant="outline" className="h-4 px-1 font-mono text-[9px] text-muted-foreground">
                    {d.sheetName}
                  </Badge>
                )}
                {!added && <Plus className="h-3 w-3 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
