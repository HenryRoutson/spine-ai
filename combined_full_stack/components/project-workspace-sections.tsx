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
    <ul className="grid gap-3 sm:grid-cols-2">
      {templates.map((t) => (
        <li key={t.id} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t.name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{t.kind}</p>
            </div>
            <Badge variant="outline" className="shrink-0 font-mono text-[9px]">
              {t.moduleCount} steps
            </Badge>
          </div>
          <p className="mb-3 font-mono text-[10px] text-muted-foreground">
            {t.inputCount} input slot{t.inputCount === 1 ? "" : "s"}
          </p>
          <Button size="sm" onClick={() => onClone(t.id)} disabled={busyId === t.id}>
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
