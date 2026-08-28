"use client"

import { useCallback, useRef, useState, type ReactNode } from "react"
import { APP_SQL_CHANGED_EVENT } from "@/lib/app-sql"
import { HostedSiteSimpleTrace } from "@/components/share/hosted-site-simple-trace"
import { useHostedSqlRows } from "@/components/share/hosted-site-sql-widget"
import { awaitSharedRun, fetchSharedLink, startSharedRun, uploadSharedDoc } from "@/lib/shared-run-client"
import { hostedActionButtonLabel, hostedActionTrigger } from "@/lib/hosted-site-slots"
import {
  hostedActionCardTitle,
  hostedArithLabels,
  hostedPreviewLines,
  parseHostedNumber,
  type hosted_action_kind,
} from "@/lib/hosted-collatz"
import { mergeStepStates, type StepUiState } from "@/lib/run-engine"
import { RunPhase } from "@/lib/run-phase"
import type { ModuleId, PipelineModule } from "@/lib/types"

function triggerFile(action: ReturnType<typeof hostedActionTrigger>): File {
  return new File([JSON.stringify({ action })], "trigger.json", { type: "application/json" })
}

function HostedActionCard({
  kind,
  n,
  buttonLabel,
  busy,
  error,
  onClick,
  preview,
  trace,
}: {
  kind: hosted_action_kind
  n: number | null
  buttonLabel: string
  busy?: boolean
  error?: string | null
  onClick?: () => void
  preview?: boolean
  trace?: ReactNode
}) {
  const lines = hostedPreviewLines(kind, n)
  // AI : each card shows both sides of the arithmetic so Double and 3n+1 stay visible together.
  return (
    <div className="hs-action-widget hs-action-card" data-spine-id="site.sql-action">
      <p className="hs-action-card-title">{hostedActionCardTitle(kind)}</p>
      <div className="hs-action-preview">
        {lines.map((line) => (
          <div key={`${line.expr}:${line.result}`} className="hs-action-eq">
            <span className="hs-action-eq-expr">{line.expr}</span>
            <span className="hs-action-eq-to">{line.result}</span>
          </div>
        ))}
      </div>
      <button type="button" className="hs-action-btn" disabled={preview || busy} onClick={onClick}>
        {busy ? "Running…" : buttonLabel}
      </button>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {trace}
    </div>
  )
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
  const kind = hostedActionTrigger(alias)
  const shown = label ?? hostedActionButtonLabel(alias)
  // AI : live n drives the card equations; pin it while the run is in flight.
  const { rows } = useHostedSqlRows(linkId, "shared_number")
  const liveN = parseHostedNumber(rows?.[0]?.value)
  const liveNRef = useRef(liveN)
  liveNRef.current = liveN

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<RunPhase>(RunPhase.Idle)
  const [modules, setModules] = useState<PipelineModule[]>([])
  const [stepStates, setStepStates] = useState<Map<ModuleId, StepUiState>>(new Map())
  const [traceLabels, setTraceLabels] = useState<string[]>(() => hostedArithLabels(kind, liveN))
  const [pinnedN, setPinnedN] = useState<number | null>(null)

  const previewN = pinnedN ?? liveN

  const run = useCallback(async () => {
    const startN = liveNRef.current
    setBusy(true)
    setError(null)
    setPhase(RunPhase.Running)
    setStepStates(new Map())
    setPinnedN(startN)
    setTraceLabels(hostedArithLabels(kind, startN))
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
      await awaitSharedRun(
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
      setPhase(RunPhase.Done)
      window.dispatchEvent(new Event(APP_SQL_CHANGED_EVENT))
    } catch (err) {
      setError((err as Error).message)
      setPhase(RunPhase.Idle)
    } finally {
      setPinnedN(null)
      setBusy(false)
    }
  }, [alias, kind, linkId])

  return (
    <HostedActionCard
      kind={kind}
      n={previewN}
      buttonLabel={shown}
      busy={busy}
      error={error}
      onClick={() => void run()}
      trace={
        <HostedSiteSimpleTrace modules={modules} stepStates={stepStates} phase={phase} labels={traceLabels} />
      }
    />
  )
}

export function HostedSiteActionPreview({
  alias,
  label,
}: {
  alias?: string
  label?: string
}) {
  const kind = hostedActionTrigger(alias)
  return (
    <HostedActionCard kind={kind} n={1} buttonLabel={label ?? hostedActionButtonLabel(alias)} preview />
  )
}
