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
import { RunningJobDetail } from "@/components/running-job-detail"

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
  const { open, toggle, closeHub, jobs, runningCount, stopJob, selectedJobId, openJobDetail } = useRunJobs()
  const { openLogging } = useAppShell()

  const visibleJobs = useMemo(
    () => [...jobs].sort((a, b) => b.startedAt - a.startedAt),
    [jobs],
  )
  const selectedJob = selectedJobId ? (jobs.find((j) => j.id === selectedJobId) ?? null) : null
  const fullscreen = selectedJob != null

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
        <div
          className={cn(
            "fixed z-[55] flex flex-col border-border bg-background shadow-xl",
            fullscreen ? "inset-0 border-0" : "inset-y-0 right-0 w-full border-l sm:max-w-md",
          )}
        >
          {fullscreen ? (
            <RunningJobDetail job={selectedJob} />
          ) : (
            <>
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Running jobs
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {runningCount} active · {visibleJobs.length} recent
              </p>
            </div>
            <Button type="button" size="icon-sm" variant="ghost" onClick={closeHub} aria-label="Close" spineId="jobs.close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {visibleJobs.length === 0 ? (
              <p className="p-4 font-mono text-[10px] text-muted-foreground">
                Pipeline runs and tests appear here while they execute. Click a job for the full-screen live
                trace — you can still start more runs from Inference.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {visibleJobs.map((job) => (
                  <li key={job.id} className="px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openJobDetail(job.id)}
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
                          spineId="jobs.stop"
                        >
                          <Square className="h-3.5 w-3.5 fill-current" />
                        </Button>
                      )}
                    </div>

                    {job.status === "running" && (
                      <button
                        type="button"
                        className="mt-2 w-full space-y-1 text-left"
                        onClick={() => openJobDetail(job.id)}
                      >
                        <Progress value={job.progressPct} className="h-1.5" />
                        <p className="font-mono text-[9px] text-muted-foreground">
                          {job.progressPct}% · click for full screen
                        </p>
                      </button>
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
            </>
          )}
        </div>
      )}
    </>
  )
}
