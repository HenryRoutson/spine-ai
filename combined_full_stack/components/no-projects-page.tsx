"use client"

import { useState } from "react"
import { Copy, FolderKanban, Loader2 } from "lucide-react"
import {
  BlankProjectButton,
  ExampleTemplateGrid,
} from "@/components/project-workspace-sections"
import type { ProjectId } from "@/lib/types"

// AI : standalone zero-projects page — rendered by StoreProvider INSTEAD of the app shell,
// AI : so none of the sub tabs (pipeline / structure / docs / …) exist until a project does.
export function NoProjectsPage({
  syncing = false,
  onCreateBlank,
  onCloneTemplate,
}: {
  syncing?: boolean
  onCreateBlank: () => Promise<unknown>
  onCloneTemplate: (templateId: ProjectId) => Promise<unknown>
}) {
  const [busy, setBusy] = useState<string | null>(null)

  if (syncing) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 bg-background px-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="font-mono text-xs text-muted-foreground">loading projects…</p>
      </div>
    )
  }

  async function handleCreateBlank() {
    setBusy("blank")
    try {
      await onCreateBlank()
    } finally {
      setBusy(null)
    }
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
          <BlankProjectButton
            className="mt-4"
            busy={busy === "blank"}
            onClick={() => void handleCreateBlank()}
          />
        </div>

        <div className="mb-3 flex items-center gap-2">
          <Copy className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Example templates</h2>
        </div>
        <ExampleTemplateGrid
          busyId={busy}
          onClone={(id) => void handleClone(id)}
        />
      </div>
    </div>
  )
}
