"use client"

import { useMemo } from "react"
import {
  CircleCheck,
  CircleX,
  FlaskConical,
  Loader2,
  Play,
  Square,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useRunJobs } from "@/lib/run-jobs-context"
import { useAppShell } from "@/lib/app-shell"
import { cn } from "@/lib/utils"
import type { TrackedRunJob } from "@/lib/run-jobs-types"

function sourceLabel(source: TrackedRunJob["source"]) {
  return source === "inference" ? "Inference" : "Testing"
}

function statusBadge(job: TrackedRunJob) {
  if (job.status === "running") {
    return (
      <Badge variant="outline" className="gap-1 font-mono text-[9px]">
        <Loader2 className="h-3 w-3 animate-spin" />
        running
      </Badge>
    )
  }
  if (job.status === "error") {
    return (
      <Badge variant="outline" className="border-destructive/50 font-mono text-[9px] text-destructive">
        failed
      </Badge>
    )
  }
  if (job.status === "stopped") {
    return (
      <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
        stopped
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 font-mono text-[9px] text-chart-2">
      <CircleCheck className="h-3 w-3" />
      done
    </Badge>
  )
}

export function RunningJobsHub() {
  const { open, toggle, jobs, runningCount, stopJob } = useRunJobs()
  const { setActiveWindow, openTesting, openLogging } = useAppShell()

  const visibleJobs = useMemo(
    () => [...jobs].sort((a, b) => b.startedAt - a.startedAt),
    [jobs],
  )

  function openJob(job: TrackedRunJob) {
    if (job.source === "inference") {
      setActiveWindow("inference")
      return
    }
    openTesting(job.testDocName ?? undefined)
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={open ? "secondary" : "outline"}
        onClick={toggle}
        aria-label="Running jobs"
        title="Running jobs"
        className="relative shrink-0 font-mono text-[11px]"
      >
        <Play className="h-3.5 w-3.5" />
        Runs
        {runningCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] text-destructive-foreground">
            {runningCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="fixed inset-y-0 right-0 z-[55] flex w-full sm:max-w-md flex-col border-l border-border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Running jobs
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {runningCount} active · {visibleJobs.length} recent
              </p>
            </div>
            <Button type="button" size="icon-sm" variant="ghost" onClick={toggle} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {visibleJobs.length === 0 ? (
              <p className="p-4 font-mono text-[10px] text-muted-foreground">
                Pipeline runs and tests appear here while they execute. Switch tabs freely — jobs keep running
                in the background.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {visibleJobs.map((job) => (
                  <li key={job.id} className="px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openJob(job)}
                        className="min-w-0 flex-1 text-left hover:opacity-80"
                      >
                        <div className="flex items-center gap-2">
                          {job.source === "testing" ? (
                            <FlaskConical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <Play className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="truncate font-mono text-[11px]">{job.label}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[9px] text-muted-foreground">
                          <span>{sourceLabel(job.source)}</span>
                          {statusBadge(job)}
                          {job.activeStepLabel && job.status === "running" && (
                            <span className="truncate">{job.activeStepLabel}</span>
                          )}
                        </div>
                      </button>
                      {job.status === "running" && (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="shrink-0 text-destructive hover:text-destructive"
                          aria-label="Stop job"
                          onClick={() => stopJob(job.id)}
                        >
                          <Square className="h-3.5 w-3.5 fill-current" />
                        </Button>
                      )}
                    </div>

                    {job.status === "running" && (
                      <div className="mt-2 space-y-1">
                        <Progress value={job.progressPct} className="h-1.5" />
                        <p className="font-mono text-[9px] text-muted-foreground">{job.progressPct}%</p>
                      </div>
                    )}

                    {job.status === "error" && job.errorMessage && (
                      <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2">
                        <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                        <p className="font-mono text-[10px] text-destructive">{job.errorMessage}</p>
                      </div>
                    )}

                    {job.status === "done" && job.runId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn("mt-2 h-7 font-mono text-[10px]")}
                        onClick={() => openLogging(job.runId)}
                      >
                        View in Logging
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      )}
    </>
  )
}
