"use client"

// AI : fullscreen live step-trace for a hub job — watching a run must not depend on the Inference tab staying attached.
import { useMemo, useRef } from "react"
import { ArrowLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RunStopButton } from "@/components/run-with-stop-button"
import { InferenceStepTracePanel } from "@/components/inference/inference-step-trace-panel"
import { ChatbotPanel, GoToLoggingButton, HumanReviewPanel } from "@/components/inference/inference-run-chrome"
import { useRunJobs } from "@/lib/run-jobs-context"
import { useOptionalStore } from "@/lib/store"
import { useAppShell } from "@/lib/app-shell"
import { useCyclingWaitPhrase } from "@/lib/inference-wait-phrases"
import { partitionLogsByModule } from "@/lib/step-logs"
import { TrackedRunJobStatus, type TrackedRunJob } from "@/lib/run-jobs-types"
import { RunPhase } from "@/lib/run-phase"

function jobPhase(job: TrackedRunJob): RunPhase {
  return job.status === TrackedRunJobStatus.Running ? RunPhase.Running : RunPhase.Done
}

export function RunningJobDetail({ job }: { job: TrackedRunJob }) {
  const { closeJobDetail, closeHub, stopJob, resolveHumanReview, resolveChatbot } = useRunJobs()
  const { openLogging } = useAppShell()
  const store = useOptionalStore()
  const logEndRef = useRef<HTMLDivElement>(null)
  const modules = job.modules.length > 0 ? job.modules : (store?.modules ?? [])
  const docs = store?.docs ?? []
  const models = store?.models ?? []
  const phase = jobPhase(job)
  const waitPhrase = useCyclingWaitPhrase(
    job.status === TrackedRunJobStatus.Running,
    job.activeStepLabel ? [job.activeStepLabel] : [],
  )

  const activeModuleId = useMemo(() => {
    for (const m of modules) {
      if (job.stepStates.get(m.id)?.status === "running") return m.id
    }
    return undefined
  }, [job.stepStates, modules])

  const logsByModule = useMemo(
    () => partitionLogsByModule(job.debugLogs, modules.map((m) => m.id), activeModuleId),
    [job.debugLogs, modules, activeModuleId],
  )

  const pendingModule = job.pendingHumanReview
    ? modules.find((m) => m.id === job.pendingHumanReview!.moduleId)
    : job.pendingChatbot
      ? modules.find((m) => m.id === job.pendingChatbot!.moduleId)
      : undefined
  const doneRunId = job.runId

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" size="icon-sm" variant="ghost" onClick={closeJobDetail} aria-label="Back to jobs">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px]">{job.label}</p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {job.source === "inference" ? "Inference" : "Testing"}
              {job.activeStepLabel && job.status === TrackedRunJobStatus.Running ? ` · ${job.activeStepLabel}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {job.status === TrackedRunJobStatus.Running && (
            <RunStopButton
              onClick={() => stopJob(job.id)}
              spineId={job.source === "inference" ? "inference.stop" : "testing.stop"}
            />
          )}
          <Button type="button" size="icon-sm" variant="ghost" onClick={closeHub} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
          {job.pendingHumanReview && (
            <HumanReviewPanel
              spec={job.pendingHumanReview}
              module={pendingModule}
              onApprove={() => resolveHumanReview(job.id, "approved")}
              onReject={() => resolveHumanReview(job.id, "rejected")}
            />
          )}
          {job.pendingChatbot && job.jobId && (
            <ChatbotPanel
              spec={job.pendingChatbot}
              module={pendingModule}
              jobId={job.jobId}
              onComplete={(result) => resolveChatbot(job.id, result)}
            />
          )}
          {job.status === TrackedRunJobStatus.Error && job.errorMessage && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 font-mono text-[11px] text-destructive">
              {job.errorMessage}
            </p>
          )}
          {modules.length > 0 ? (
            <InferenceStepTracePanel
              modules={modules}
              phase={phase}
              stepStates={job.stepStates}
              run={null}
              progressPct={job.progressPct}
              waitPhrase={waitPhrase}
              logsByModule={logsByModule}
              codeExecByModule={job.codeExecByModule}
              logEndRef={logEndRef}
              docs={docs}
              models={models}
              inputDocs={job.inputDocs}
            />
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">{job.progressPct}% complete</p>
          )}
          {job.status === TrackedRunJobStatus.Done && doneRunId && (
            <GoToLoggingButton onClick={() => openLogging(doneRunId)} />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
