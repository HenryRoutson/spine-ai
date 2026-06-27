"use client"

import { JsonStructureMatches } from "@/components/json-structure-matches"
import { JsonViewerEmbed } from "@/components/json-viewer"
import { cn } from "@/lib/utils"
import type { JsonViewerHumanViewId } from "@/lib/json-viewer"
import type { StructureModel } from "@/lib/types"

export function JsonPreviewPanel({
  json,
  models,
  className,
  defaultView,
}: {
  json: string
  models?: StructureModel[]
  className?: string
  defaultView?: JsonViewerHumanViewId
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <JsonStructureMatches json={json} models={models} />
      <JsonViewerEmbed json={json} className="min-h-0 flex-1" defaultView={defaultView} />
    </div>
  )
}
