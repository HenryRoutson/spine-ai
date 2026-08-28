"use client"

import { Share2, Upload, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MarkdownView } from "@/components/highlight"
import { inputTypeLabel, orderedInputModules } from "@/lib/inference-input"
import type { PipelineModule } from "@/lib/types"
import { cn } from "@/lib/utils"

export function SharedLinkPreview({
  projectName,
  viewerMarkdown,
  modules,
  variant = "page",
}: {
  projectName: string
  viewerMarkdown: string
  modules: PipelineModule[]
  variant?: "page" | "site"
}) {
  const inputs = orderedInputModules(modules)
  const md = viewerMarkdown.trim()

  return (
    <div className="bg-background text-foreground">
      {variant === "page" ? (
        <header className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{projectName}</p>
            </div>
            <Badge variant="outline" className="font-mono text-[9px]">
              shared pipeline
            </Badge>
          </div>
        </header>
      ) : null}

      <div className={cn("space-y-4", variant === "site" ? "p-4" : "p-5")}>
        {md ? (
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <MarkdownView md={md} />
          </div>
        ) : null}

        {variant === "site" || inputs.length === 0 ? null : (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            pipeline inputs · {inputs.length} slot{inputs.length === 1 ? "" : "s"}
          </p>
          {inputs.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-3 py-2"
            >
              <Upload className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{m.label}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {inputTypeLabel(m.inputType)}
                  {m.note?.trim() ? ` · ${m.note.trim()}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
        )}

        <Button type="button" className="w-full gap-2" disabled>
          <Zap className="h-4 w-4" />
          Run
        </Button>
      </div>
    </div>
  )
}
