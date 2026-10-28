"use client"

import { useEffect, useMemo } from "react"
import { useOptionalAppShell } from "@/lib/app-shell"
import {
  findStructureMatchesForDoc,
  parseAndMatchStructures,
} from "@/lib/structure-match-parse"
import { mergeInferredStructuresForDoc, modelsChanged } from "@/lib/sync-doc-structures"
import { catalogFromDocs } from "@/lib/sql-catalog"
import { buildIdIndex } from "@/lib/sql-id-index"
import { useOptionalStore, uid } from "@/lib/store"
import { StructureMatchChips } from "@/components/structure-match-chips"
import { cn } from "@/lib/utils"
import type { DocRef, InputType, StructureModel, StructureModelId } from "@/lib/types"

export function JsonStructureMatches({
  json,
  models: modelsProp,
  doc,
  className,
  bare = false,
}: {
  json: string
  models?: StructureModel[]
  doc?: Pick<DocRef, "id" | "name" | "type">
  className?: string
  bare?: boolean
}) {
  const store = useOptionalStore()
  const shell = useOptionalAppShell()
  const models = modelsProp ?? store?.models
  const typeAliases = store?.typeAliases ?? []
  const openStructure = shell?.openStructure

  // AI : merge inferred structures synchronously for display, persist in effect.
  const displayModels = useMemo(() => {
    if (!doc || !json.trim() || !models?.length) return models ?? []
    return mergeInferredStructuresForDoc(
      models,
      doc,
      json,
      () => uid<StructureModelId>(),
    )
  }, [doc, json, models])

  useEffect(() => {
    if (!doc || !store?.setModels || !models?.length) return
    if (modelsChanged(models, displayModels)) {
      store.setModels(displayModels)
    }
  }, [doc, displayModels, models, store])

  const { error, matches, expectMatches } = doc
    ? findStructureMatchesForDoc(json, displayModels, doc, typeAliases)
    : { ...parseAndMatchStructures(json, displayModels, typeAliases), expectMatches: false as const }

  const idSummary = useMemo(() => {
    if (!json.trim() || !displayModels.length || error) return []
    const catalog = catalogFromDocs(
      [
        {
          name: doc?.name ?? "preview.json",
          type: (doc?.type ?? "json") as InputType,
          content: json,
          id: doc?.id,
        },
      ],
      displayModels,
      typeAliases,
    )
    const index = buildIdIndex(catalog, displayModels)
    return index.buckets.filter((b) => b.pkCount + b.fkCount > 0)
  }, [json, displayModels, typeAliases, doc, error])

  if (!models?.length) return null

  const chips = (
    <div className="flex min-w-0 flex-col gap-1">
      <StructureMatchChips
        matches={matches}
        error={error}
        expectMatches={expectMatches}
        showGeneralBadge
        onOpenStructure={openStructure}
      />
      {idSummary.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Ids
          </span>
          {idSummary.map((b) => (
            <span
              key={b.idType}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-foreground"
              title={`${b.idType}: ${b.missing} missing, ${b.unused} unused, ${b.duplicate} duplicate`}
            >
              {b.idType}
              {b.missing > 0 && <span className="text-destructive">{b.missing} missing</span>}
              {b.duplicate > 0 && <span className="text-destructive">{b.duplicate} dup</span>}
              {b.missing === 0 && b.duplicate === 0 && (
                <span className="text-muted-foreground">{b.pkCount} pk</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )

  if (bare) return <div className={className}>{chips}</div>

  return (
    <div className={cn("border-b border-border bg-secondary/20 px-4 py-2.5", className)}>{chips}</div>
  )
}
