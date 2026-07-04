"use client"

import { useState } from "react"
import { Copy, FolderKanban, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useProjectTemplates } from "@/lib/use-project-templates"
import type { ProjectId } from "@/lib/types"

// AI : standalone zero-projects page — rendered by StoreProvider INSTEAD of the app shell,
// AI : so none of the sub tabs (pipeline / structure / docs / …) exist until a project does.
export function NoProjectsPage({
  syncing = false,
  onCreateBlank,
  onCloneTemplate,
}: {
  syncing?: boolean
  onCreateBlank: () => void
  onCloneTemplate: (templateId: ProjectId) => Promise<unknown>
}) {
  const { templates, loading } = useProjectTemplates()
  const [busy, setBusy] = useState<string | null>(null)

  if (syncing) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 bg-background px-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="font-mono text-xs text-muted-foreground">loading projects…</p>
      </div>
    )
  }

  async function handleClone(templateId: ProjectId) {
    setBusy(templateId)
    try {
      await onCloneTemplate(templateId)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-dvh flex-col items-center overflow-y-auto bg-background px-6 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <FolderKanban className="mb-3 h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">No projects</h1>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            You deleted your last project. Start from a blank pipeline, or clone an example
            template.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setBusy("blank")
              onCreateBlank()
            }}
            disabled={busy === "blank"}
          >
            {busy === "blank" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Blank project
          </Button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <Copy className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Example templates</h2>
        </div>
        {loading && templates.length === 0 ? (
          <p className="font-mono text-[11px] text-muted-foreground">Loading templates…</p>
        ) : (
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
                <Button size="sm" onClick={() => void handleClone(t.id)} disabled={busy === t.id}>
                  {busy === t.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Clone
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
