"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { HostedSiteSimpleTrace } from "@/components/share/hosted-site-simple-trace"
import { useHostedSqlRows } from "@/components/share/hosted-site-sql-widget"
import { paintHostedSqlValue, releaseHostedSqlPaint } from "@/lib/hosted-sql-channel"
import { awaitSharedRun, fetchSharedLink, startSharedRun, uploadSharedDoc } from "@/lib/shared-run-client"
import { hostedActionButtonLabel, hostedActionTrigger } from "@/lib/hosted-site-slots"
import {
  hostedActionCardTitle,
  hostedPreviewLines,
  parseHostedNumber,
  type hosted_action_kind,
  type hosted_preview_line,
} from "@/lib/hosted-collatz"
import {
  hostedPipelineArithPreview,
  hostedPipelinePreviewLines,
  type hosted_pipeline_step,
} from "@/lib/hosted-pipeline-trace"
import { mergeStepStates, type StepUiState } from "@/lib/run-engine"
import { RunPhase } from "@/lib/run-phase"
import type { ModuleId, PipelineModule } from "@/lib/types"

function holdMs(ms = 650): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function triggerFile(action: ReturnType<typeof hostedActionTrigger>): File {
  return new File([JSON.stringify({ action })], "trigger.json", { type: "application/json" })
}

function HostedActionCard({
  kind,
  lines,
  buttonLabel,
  busy,
  error,
  onClick,
  preview,
  trace,
}: {
  kind: hosted_action_kind
  lines: hosted_preview_line[]
  buttonLabel: string
  busy?: boolean
  error?: string | null
  onClick?: () => void
  preview?: boolean
  trace?: ReactNode
}) {
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
  const { rows } = useHostedSqlRows(linkId, "shared_number")
  const liveN = parseHostedNumber(rows?.[0]?.value)
  const liveNRef = useRef(liveN)
  liveNRef.current = liveN

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<RunPhase>(RunPhase.Idle)
  const [modules, setModules] = useState<PipelineModule[]>([])
  const [stepStates, setStepStates] = useState<Map<ModuleId, StepUiState>>(new Map())
  const [planned, setPlanned] = useState<hosted_pipeline_step[]>([])
  const [pinnedN, setPinnedN] = useState<number | null>(null)

  const previewN = pinnedN ?? liveN
  // AI : idle equations come from walking the pipeline JSON; JS Collatz math is studio-only fallback.
  const lines =
    modules.length > 0
      ? hostedPipelinePreviewLines(modules, kind, previewN)
      : hostedPreviewLines(kind, previewN)

  useEffect(() => {
    let cancelled = false
    void fetchSharedLink(linkId, alias)
      .then((link) => {
        if (!cancelled) setModules(link.modules)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [alias, linkId])

  const run = useCallback(async () => {
    const startN = liveNRef.current
    setBusy(true)
    setError(null)
    setPhase(RunPhase.Running)
    setStepStates(new Map())
    setPlanned([])
    setPinnedN(startN)
    try {
      const link = await fetchSharedLink(linkId, alias)
      setModules(link.modules)
      const preview = startN != null ? hostedPipelineArithPreview(link.modules, kind, startN) : []
      setPlanned(preview)
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
      const seenOk = new Set<ModuleId>()
      let revealing = Promise.resolve()
      await awaitSharedRun(
        linkId,
        jobId,
        progressToken,
        {
          onStep: (steps) => {
            setStepStates((prev) => mergeStepStates(prev, steps))
            const fresh: hosted_pipeline_step[] = []
            for (const step of steps) {
              if (step.status !== "ok" && step.status !== "cached") continue
              if (seenOk.has(step.moduleId)) continue
              seenOk.add(step.moduleId)
              const arith = preview.find((row) => row.moduleId === step.moduleId)
              if (arith) fresh.push(arith)
            }
            if (fresh.length === 0) return
            // AI : reveal each JSON SQL UPDATE in order so 1→3 can paint before 4.
            revealing = revealing.then(async () => {
              for (const [i, row] of fresh.entries()) {
                paintHostedSqlValue(linkId, "shared_number", row.to)
                if (i < fresh.length - 1) await holdMs()
              }
            })
          },
        },
        180,
      )
      await revealing
      setPhase(RunPhase.Done)
    } catch (err) {
      setError((err as Error).message)
      setPhase(RunPhase.Idle)
    } finally {
      releaseHostedSqlPaint(linkId, "shared_number")
      setPinnedN(null)
      setBusy(false)
    }
  }, [alias, kind, linkId])

  return (
    <HostedActionCard
      kind={kind}
      lines={lines}
      buttonLabel={shown}
      busy={busy}
      error={error}
      onClick={() => void run()}
      trace={<HostedSiteSimpleTrace planned={planned} stepStates={stepStates} phase={phase} />}
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
    <HostedActionCard
      kind={kind}
      lines={hostedPreviewLines(kind, 1)}
      buttonLabel={label ?? hostedActionButtonLabel(alias)}
      preview
    />
  )
}
