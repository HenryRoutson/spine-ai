"use client"

import { useMemo } from "react"
import { useOptionalAppShell } from "@/lib/app-shell"
import { findMatchingStructures } from "@/lib/structure-match"
import { useOptionalStore } from "@/lib/store"
import { StructureMatchChips } from "@/components/structure-match-chips"
import { cn } from "@/lib/utils"
import type { StructureModel } from "@/lib/types"

export function JsonStructureMatches({
  json,
  models: modelsProp,
  className,
  bare = false,
}: {
  json: string
  models?: StructureModel[]
  className?: string
  bare?: boolean
}) {
  const store = useOptionalStore()
  const shell = useOptionalAppShell()
  const models = modelsProp ?? store?.models
  const openStructure = shell?.openStructure

  const { error, matches } = useMemo(() => {
    if (!models?.length) return { error: null as string | null, matches: [] }
    try {
      const parsed = JSON.parse(json) as unknown
      return { error: null as string | null, matches: findMatchingStructures(parsed, models) }
    } catch (e) {
      return { error: (e as Error).message, matches: [] }
    }
  }, [json, models])

  if (!models?.length) return null

  const chips = (
    <StructureMatchChips
      matches={matches}
      error={error}
      showGeneralBadge
      onOpenStructure={openStructure}
    />
  )

  if (bare) return <div className={className}>{chips}</div>

  return (
    <div className={cn("border-b border-border bg-secondary/20 px-4 py-2.5", className)}>{chips}</div>
  )
}
