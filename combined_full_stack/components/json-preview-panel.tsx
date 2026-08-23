"use client"

import { Maximize2 } from "lucide-react"
import { JsonStructureMatches } from "@/components/json-structure-matches"
import { JsonViewerEmbed } from "@/components/json-viewer"
import { DataDownloadMenu } from "@/components/data-download-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { JsonViewerHumanViewId } from "@/lib/json-viewer"
import type { DocRef, StructureModel } from "@/lib/types"

export function JsonPreviewPanel({
  json,
  models,
  doc,
  className,
  defaultView,
  downloadBaseName,
  onFullscreen,
  excelOnly = false,
}: {
  json: string
  models?: StructureModel[]
  doc?: Pick<DocRef, "id" | "name" | "type">
  className?: string
  defaultView?: JsonViewerHumanViewId
  downloadBaseName?: string
  onFullscreen?: () => void
  excelOnly?: boolean
}) {
  // AI : DONE (media-view-A-registry) — this stays the JSON/table tab. DataViewPanel wraps it + media.
  const view = excelOnly ? "table" : defaultView
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className={cn("flex items-start gap-2 border-b border-border bg-secondary/20 px-4 py-2.5", excelOnly ? "justify-end" : "justify-between")}>
        {excelOnly ? null : (
          <JsonStructureMatches json={json} models={models} doc={doc} bare className="min-w-0 flex-1" />
        )}
        {excelOnly && onFullscreen ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-[10px]"
            onClick={onFullscreen}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Preview
          </Button>
        ) : null}
        <DataDownloadMenu
          content={json}
          models={models}
          baseNameOverride={downloadBaseName}
          formats={excelOnly ? ["xlsx"] : undefined}
          className="shrink-0"
        />
      </div>
      <JsonViewerEmbed
        json={json}
        className={excelOnly ? "h-full min-h-[16rem] flex-1" : "min-h-0 flex-1"}
        defaultView={view}
        lockedView={excelOnly ? "table" : undefined}
        onFullscreen={onFullscreen}
      />
    </div>
  )
}
