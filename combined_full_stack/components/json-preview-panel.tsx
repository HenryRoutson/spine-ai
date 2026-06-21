"use client"

import { JsonStructureMatches } from "@/components/json-structure-matches"
import { JsonViewerEmbed } from "@/components/json-viewer"
import { cn } from "@/lib/utils"

export function JsonPreviewPanel({
  json,
  className,
}: {
  json: string
  className?: string
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <JsonStructureMatches json={json} />
      <JsonViewerEmbed json={json} className="min-h-0 flex-1" />
    </div>
  )
}
