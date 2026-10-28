"use client"

import { useCallback } from "react"
import { ArrowLeft, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { OwnPipelineRunPanel } from "@/components/share/own-pipeline-run-panel"
import { readAccountStateCache } from "@/lib/project-state-cache"
import { useOptionalConsumerStore, useOptionalStore } from "@/lib/store"
import { useAppShell } from "@/lib/app-shell"
import { useWorkspaceBilling } from "@/lib/use-workspace-billing"
import type { ProjectId } from "@/lib/types"

type OwnPipelineRunnerProps = {
  projectId: ProjectId
  onBack: () => void
}

export function OwnPipelineRunner({ projectId, onBack }: OwnPipelineRunnerProps) {
  const { setActiveWindow } = useAppShell()
  const { refreshBilling } = useWorkspaceBilling()
  const consumer = useOptionalConsumerStore()
  const builder = useOptionalStore()
  const cacheProjects = readAccountStateCache()?.projects
  const project =
    consumer?.projects.find((p) => p.id === projectId) ??
    cacheProjects?.find((p) => p.id === projectId) ??
    (builder?.project.id === projectId ? builder.project : null)

  const onRunComplete = useCallback(() => {
    void refreshBilling()
  }, [refreshBilling])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          My pipelines
        </Button>
        <User className="h-4 w-4 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{project?.name ?? projectId}</h2>
          <p className="truncate text-xs text-muted-foreground">Your pipeline</p>
        </div>
        <Badge variant="outline" className="font-mono text-[9px]">
          my pipeline
        </Badge>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-4xl">
          <OwnPipelineRunPanel
            projectId={projectId}
            onRunComplete={onRunComplete}
            onOpenBilling={() => setActiveWindow("billing")}
          />
        </div>
      </div>
    </div>
  )
}
