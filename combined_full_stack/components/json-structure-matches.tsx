"use client"

import { useEffect, useMemo } from "react"
import { useOptionalAppShell } from "@/lib/app-shell"
import {
  findStructureMatchesForDoc,
  parseAndMatchStructures,
} from "@/lib/structure-match-parse"
import { mergeInferredStructuresForDoc, modelsChanged } from "@/lib/sync-doc-structures"
import { useOptionalStore, uid } from "@/lib/store"
import { StructureMatchChips } from "@/components/structure-match-chips"
import { cn } from "@/lib/utils"
import type { DocRef, StructureModel, StructureModelId } from "@/lib/types"

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

  if (!models?.length) return null

  const chips = (
    <StructureMatchChips
      matches={matches}
      error={error}
      expectMatches={expectMatches}
      showGeneralBadge
      onOpenStructure={openStructure}
    />
  )

  if (bare) return <div className={className}>{chips}</div>

  return (
    <div className={cn("border-b border-border bg-secondary/20 px-4 py-2.5", className)}>{chips}</div>
  )
}
