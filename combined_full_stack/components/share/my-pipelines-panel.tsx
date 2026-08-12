"use client"

import { useMemo } from "react"
import { AlertTriangle, Play, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { readAccountStateCache } from "@/lib/project-state-cache"
import { useOptionalConsumerStore, useOptionalStore } from "@/lib/store"
import { timeAgo } from "@/lib/time-ago"
import { projectRunBlockReason, projectRunBlocked } from "@/lib/workspace-validity-ui"
import type { ProjectId } from "@/lib/types"

type MyPipelinesPanelProps = {
  onRun: (projectId: ProjectId) => void
}

export function MyPipelinesPanel({ onRun }: MyPipelinesPanelProps) {
  const consumer = useOptionalConsumerStore()
  const builder = useOptionalStore()
  const cacheProjects = readAccountStateCache()?.projects

  const projects = useMemo(() => {
    const list = consumer?.projects ?? cacheProjects ?? []
    return [...list].sort((a, b) => (b.lastOpenedAt ?? b.createdAt ?? 0) - (a.lastOpenedAt ?? a.createdAt ?? 0))
  }, [consumer?.projects, cacheProjects])

  const activeProjectId = builder?.project.id

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pipelines you built in Build mode. Pick inputs and run — no builder UI here.
      </p>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No pipelines yet — switch to Build to create one, or clone an example template.
        </p>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => {
            const runBlocked = projectRunBlocked(p)
            const blockReason = runBlocked ? projectRunBlockReason(p) : null

            return (
              <li
                key={p.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5",
                  runBlocked ? "border-destructive/50" : "border-border",
                )}
              >
                {runBlocked ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                ) : (
                  <User className="h-4 w-4 shrink-0 text-primary" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {p.modules.length} steps ·{" "}
                    {p.modules.filter((m) => m.kind === "input").length} input
                    {p.createdAt != null ? ` · ${timeAgo(p.createdAt)}` : ""}
                    {activeProjectId === p.id ? " · open in builder" : ""}
                  </p>
                  {blockReason ? (
                    <p className="mt-1 text-xs text-destructive">{blockReason}</p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  disabled={runBlocked}
                  onClick={() => onRun(p.id)}
                >
                  <Play className="h-3.5 w-3.5" />
                  Run
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
