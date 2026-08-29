"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { HostedSiteSimpleTrace } from "@/components/share/hosted-site-simple-trace"
import { useHostedSqlRows } from "@/components/share/hosted-site-sql-widget"
import { paintHostedSqlValue, releaseHostedSqlPaint } from "@/lib/hosted-sql-channel"
import { awaitSharedRun, fetchSharedLink, startSharedRun, uploadSharedDoc } from "@/lib/shared-run-client"
import {
  hostedActionBinding,
  hostedActionCardTitle,
  hostedActionPayload,
  hostedActionTable,
  type HostedSiteActionBinding,
} from "@/lib/hosted-site-actions"
import { parseHostedNumber, type hosted_preview_line } from "@/lib/hosted-collatz"
import {
  hostedPipelineArithPreviewForBinding,
  hostedPipelinePreviewLines,
  type hosted_pipeline_step,
} from "@/lib/hosted-pipeline-trace"
import { mergeStepStates, type StepUiState } from "@/lib/run-engine"
import { RunPhase } from "@/lib/run-phase"
import type { ModuleId, PipelineModule } from "@/lib/types"

function holdMs(ms = 900): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function triggerFile(payload: Record<string, unknown>): File {
  return new File([JSON.stringify(payload)], "trigger.json", { type: "application/json" })
}

function HostedActionCard({
  title,
  lines,
  buttonLabel,
  busy,
  error,
  onClick,
  preview,
  trace,
}: {
  title: string
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
      <p className="hs-action-card-title">{title}</p>
      <div className="hs-action-preview">
        {lines.length === 0 ? (
          <p className="text-xs text-muted-foreground">Runs the bound pipeline</p>
        ) : (
          lines.map((line) => (
            <div key={`${line.expr}:${line.result}`} className="hs-action-eq">
              <span className="hs-action-eq-expr">{line.expr}</span>
              <span className="hs-action-eq-to">{line.result}</span>
            </div>
          ))
        )}
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
  actions = [],
}: {
  linkId: string
  alias?: string
  label?: string
  actions?: HostedSiteActionBinding[]
}) {
  const binding = hostedActionBinding(actions, alias)
  const shown = label ?? binding.label
  const table = hostedActionTable(binding)
  const { rows } = useHostedSqlRows(linkId, table ?? "")
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
  const payload = hostedActionPayload(binding)
  const lines =
    modules.length > 0 ? hostedPipelinePreviewLines(modules, binding.alias, previewN, payload) : []

  useEffect(() => {
    let cancelled = false
    void fetchSharedLink(linkId, binding.pipelineAlias ?? alias, binding.functionId)
      .then((link) => {
        if (!cancelled) setModules(link.modules)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [alias, binding.functionId, binding.pipelineAlias, linkId])

  const run = useCallback(async () => {
    const startN = liveNRef.current
    setBusy(true)
    setError(null)
    setPhase(RunPhase.Running)
    setStepStates(new Map())
    setPlanned([])
    setPinnedN(startN)
    const pipelineAlias = binding.pipelineAlias ?? alias
    try {
      const link = await fetchSharedLink(linkId, pipelineAlias, binding.functionId)
      setModules(link.modules)
      const siteActions = link.siteOptions?.actions ?? actions
      const live = hostedActionBinding(siteActions, alias)
      const paintTable = hostedActionTable(live, link.modules)
      const preview =
        startN != null ? hostedPipelineArithPreviewForBinding(link.modules, live, startN) : []
      setPlanned(preview)
      const input = link.modules.find((m) => m.kind === "input")
      if (!input) throw new Error("This page has no input step")
      const uploaded = await uploadSharedDoc(linkId, input.id, triggerFile(hostedActionPayload(live)))
      const { jobId, progressToken } = await startSharedRun(
        linkId,
        { [input.id]: [uploaded.id] },
        undefined,
        undefined,
        pipelineAlias,
        binding.functionId,
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
            if (fresh.length === 0 || !paintTable) return
            revealing = revealing.then(async () => {
              for (const row of fresh) {
                paintHostedSqlValue(linkId, paintTable, row.to)
                await holdMs()
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
      const paintTable = hostedActionTable(binding, modules)
      if (paintTable) releaseHostedSqlPaint(linkId, paintTable)
      setPinnedN(null)
      setBusy(false)
    }
  }, [actions, alias, binding, linkId, modules])

  return (
    <HostedActionCard
      title={hostedActionCardTitle(binding)}
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
  actions = [],
  modules = [],
}: {
  alias?: string
  label?: string
  actions?: HostedSiteActionBinding[]
  modules?: PipelineModule[]
}) {
  const binding = hostedActionBinding(actions, alias)
  const lines = hostedPipelinePreviewLines(modules, binding.alias, 1, hostedActionPayload(binding))
  return (
    <HostedActionCard
      title={hostedActionCardTitle(binding)}
      lines={lines}
      buttonLabel={label ?? binding.label}
      preview
    />
  )
}
