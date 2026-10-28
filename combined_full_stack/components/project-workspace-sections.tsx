"use client"

import { Copy, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useProjectTemplates } from "@/lib/use-project-templates"
import type { ProjectId } from "@/lib/types"

export function BlankProjectButton({
  busy,
  onClick,
  className,
}: {
  busy?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <Button className={className} onClick={onClick} disabled={busy} spineId="project.add">
      {busy ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Plus className="mr-1.5 h-3.5 w-3.5" />
      )}
      Blank project
    </Button>
  )
}

export function ExampleTemplateGrid({
  busyId,
  onClone,
  cloneLabel = "Clone",
  hostedOnly = false,
}: {
  busyId: string | null
  onClone: (templateId: ProjectId) => void
  cloneLabel?: string
  hostedOnly?: boolean
}) {
  const { templates, loading } = useProjectTemplates()
  const shown = hostedOnly ? templates.filter((t) => t.hasHostedSite) : templates

  if (loading && templates.length === 0) {
    return <p className="font-mono text-[11px] text-muted-foreground">Loading templates…</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {shown.map((t) => (
        <li
          key={t.id}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-snug">
              {hostedOnly && t.websiteNames?.length === 1 ? t.websiteNames[0] : t.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="font-mono text-[10px] text-muted-foreground">{t.kind}</p>
              <Badge variant="outline" className="font-mono text-[9px]">
                {t.moduleCount} steps
              </Badge>
              <p className="font-mono text-[10px] text-muted-foreground">
                {t.inputCount} input slot{t.inputCount === 1 ? "" : "s"}
              </p>
              {hostedOnly && t.websiteNames && t.websiteNames.length > 1 ? (
                <p className="font-mono text-[10px] text-muted-foreground">
                  {t.websiteNames.length} skins · {t.websiteNames.join(" · ")}
                </p>
              ) : hostedOnly && t.websiteNames?.[0] ? (
                <p className="font-mono text-[10px] text-muted-foreground">Pipeline: {t.name}</p>
              ) : t.websiteNames && t.websiteNames.length > 0 ? (
                <p className="font-mono text-[10px] text-muted-foreground">
                  Website{t.websiteNames.length === 1 ? "" : "s"}: {t.websiteNames.join(" · ")}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => onClone(t.id)}
            disabled={busyId === t.id}
            spineId="project.clone-template"
          >
            {busyId === t.id ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="mr-1.5 h-3.5 w-3.5" />
            )}
            {cloneLabel}
          </Button>
        </li>
      ))}
    </ul>
  )
}
