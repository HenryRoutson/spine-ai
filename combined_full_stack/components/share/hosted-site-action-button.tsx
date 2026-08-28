"use client"

import { useCallback, useState } from "react"
import { APP_SQL_CHANGED_EVENT } from "@/lib/app-sql"
import { HostedSiteSimpleTrace } from "@/components/share/hosted-site-simple-trace"
import { awaitSharedRun, fetchSharedLink, startSharedRun, uploadSharedDoc } from "@/lib/shared-run-client"
import { hostedActionButtonLabel, hostedActionTrigger } from "@/lib/hosted-site-slots"
import { mergeStepStates, type StepUiState } from "@/lib/run-engine"
import { useCyclingWaitPhrase } from "@/lib/inference-wait-phrases"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { RunPhase } from "@/lib/run-phase"
import type { ModuleId, PipelineModule } from "@/lib/types"

function outputValue(run: { steps?: Array<{ outputJson?: string; status?: string }> }): unknown {
  const steps = [...(run.steps ?? [])].reverse()
  for (const step of steps) {
    if (step.status && step.status !== "ok") continue
    if (!step.outputJson) continue
    try {
      return JSON.parse(step.outputJson) as unknown
    } catch {
      return step.outputJson
    }
  }
  return null
}

function triggerFile(action: ReturnType<typeof hostedActionTrigger>): File {
  return new File([JSON.stringify({ action })], "trigger.json", { type: "application/json" })
}

export function HostedSiteActionButton({
  linkId,
  alias,
  label,
}: {
  linkId: string
  alias?: string
  label?: string
}) {
  const shown = label ?? hostedActionButtonLabel(alias)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [phase, setPhase] = useState<RunPhase>(RunPhase.Idle)
  const [modules, setModules] = useState<PipelineModule[]>([])
  const [stepStates, setStepStates] = useState<Map<ModuleId, StepUiState>>(new Map())
  const runningHints = flattenPipelineModules(modules)
    .filter((m) => stepStates.get(m.id)?.status === "running")
    .map((m) => m.label)
  const waitPhrase = useCyclingWaitPhrase(phase === RunPhase.Running, runningHints)

  const run = useCallback(async () => {
    setBusy(true)
    setError(null)
    setPhase(RunPhase.Running)
    setStepStates(new Map())
    try {
      const link = await fetchSharedLink(linkId, alias)
      setModules(link.modules)
      const input = link.modules.find((m) => m.kind === "input")
      if (!input) throw new Error("This page has no input step")
      const uploaded = await uploadSharedDoc(linkId, input.id, triggerFile(hostedActionTrigger(alias)))
      const { jobId, progressToken } = await startSharedRun(
        linkId,
        { [input.id]: [uploaded.id] },
        undefined,
        undefined,
        alias,
      )
      const finished = await awaitSharedRun(
        linkId,
        jobId,
        progressToken,
        {
          onStep: (steps) => {
            setStepStates((prev) => mergeStepStates(prev, steps))
          },
        },
        220,
      )
      const value = outputValue(finished)
      const shownValue =
        value && typeof value === "object" && "value" in value
          ? String((value as { value: unknown }).value)
          : value != null
            ? JSON.stringify(value)
            : null
      setResult(shownValue)
      setPhase(RunPhase.Done)
      window.dispatchEvent(new Event(APP_SQL_CHANGED_EVENT))
    } catch (err) {
      setError((err as Error).message)
      setPhase(RunPhase.Idle)
    } finally {
      setBusy(false)
    }
  }, [alias, linkId])

  return (
    <div className="hs-action-widget" data-spine-id="site.sql-action">
      <button type="button" className="hs-action-btn" disabled={busy} onClick={() => void run()}>
        {busy ? "Running…" : shown}
      </button>
      {result != null ? <p className="hs-sql-caption">Now {result}</p> : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <HostedSiteSimpleTrace
        modules={modules}
        stepStates={stepStates}
        phase={phase}
        waitPhrase={waitPhrase}
      />
    </div>
  )
}

export function HostedSiteActionPreview({ label }: { label?: string }) {
  return (
    <div className="hs-action-widget" data-spine-id="site.sql-action">
      <button type="button" className="hs-action-btn" disabled>
        {label ?? "Double it"}
      </button>
    </div>
  )
}
