"use client"

import { JsonStructureMatches } from "@/components/json-structure-matches"
import { JsonViewerEmbed } from "@/components/json-viewer"
import { DataDownloadMenu } from "@/components/data-download-menu"
import { cn } from "@/lib/utils"
import type { JsonViewerHumanViewId } from "@/lib/json-viewer"
import type { StructureModel } from "@/lib/types"

export function JsonPreviewPanel({
  json,
  models,
  className,
  defaultView,
  downloadBaseName,
}: {
  json: string
  models?: StructureModel[]
  className?: string
  defaultView?: JsonViewerHumanViewId
  downloadBaseName?: string
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border bg-secondary/20 px-4 py-2.5">
        <JsonStructureMatches json={json} models={models} bare className="min-w-0 flex-1" />
        <DataDownloadMenu content={json} models={models} baseNameOverride={downloadBaseName} />
      </div>
      <JsonViewerEmbed json={json} className="min-h-0 flex-1" defaultView={defaultView} />
    </div>
  )
}
