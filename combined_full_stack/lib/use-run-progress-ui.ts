"use client"

import { useMemo } from "react"
import { segmentPipeline } from "@/lib/pipeline-layout"
import { formatRunErrorForDisplay, pipelineRunError } from "@/lib/run-errors"
import { useCyclingWaitPhrase } from "@/lib/inference-wait-phrases"
import type { StepUiState } from "@/lib/run-engine"
import type { ModuleId, PipelineModule, PipelineRun } from "@/lib/types"
import type { ClientStepSpec } from "@/lib/run-types"

export type RunProgressPhase = "idle" | "running" | "done"

type UseRunProgressUiArgs = {
  modules: PipelineModule[]
  phase: RunProgressPhase
  stepStates: Map<ModuleId, StepUiState>
  run: PipelineRun | null
  pendingHumanReview: ClientStepSpec | null
}

export function useRunProgressUi({
  modules,
  phase,
  stepStates,
  run,
  pendingHumanReview,
}: UseRunProgressUiArgs) {
  const progressPct = useMemo(() => {
    if (phase === "idle") return 0
    if (phase === "done") return 100
    const done = modules.filter((m) => {
      const s = stepStates.get(m.id)?.status
      return s !== undefined && s !== "idle" && s !== "running"
    }).length
    return Math.round((done / Math.max(1, modules.length)) * 100)
  }, [phase, stepStates, modules])

  const runningHints = useMemo(() => {
    const hints: string[] = []
    for (const seg of segmentPipeline(modules)) {
      if (seg.kind === "combine") {
        const combineUi = stepStates.get(seg.combine.id)
        const inputUi = stepStates.get(seg.input.id)
        if (combineUi?.status === "running") hints.push(combineUi.sub?.label ?? seg.combine.label)
        if (inputUi?.status === "running") hints.push(inputUi.sub?.label ?? seg.input.label)
        continue
      }
      const moduleUi = stepStates.get(seg.module.id)
      if (moduleUi?.status === "running") hints.push(moduleUi.sub?.label ?? seg.module.label)
    }
    return hints
  }, [stepStates, modules])

  const waitPhrase = useCyclingWaitPhrase(phase === "running", runningHints)
  const runErr = useMemo(() => (run ? pipelineRunError(run) : null), [run])
  const runErrorDisplay = useMemo(() => (run ? formatRunErrorForDisplay(run) : null), [run])
  const runButtonBusy = phase === "running" && !pendingHumanReview
  const runButtonLabel =
    pendingHumanReview != null
      ? "Waiting for your review…"
      : phase === "running"
        ? `${waitPhrase}…`
        : "Run pipeline"

  return {
    progressPct,
    waitPhrase,
    runErr,
    runErrorDisplay,
    runButtonBusy,
    runButtonLabel,
  }
}
