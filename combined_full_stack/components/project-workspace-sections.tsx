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
    <Button className={className} onClick={onClick} disabled={busy}>
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
}: {
  busyId: string | null
  onClone: (templateId: ProjectId) => void
  cloneLabel?: string
}) {
  const { templates, loading } = useProjectTemplates()

  if (loading && templates.length === 0) {
    return <p className="font-mono text-[11px] text-muted-foreground">Loading templates…</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {templates.map((t) => (
        <li
          key={t.id}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-snug">{t.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="font-mono text-[10px] text-muted-foreground">{t.kind}</p>
              <Badge variant="outline" className="font-mono text-[9px]">
                {t.moduleCount} steps
              </Badge>
              <p className="font-mono text-[10px] text-muted-foreground">
                {t.inputCount} input slot{t.inputCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => onClone(t.id)}
            disabled={busyId === t.id}
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
