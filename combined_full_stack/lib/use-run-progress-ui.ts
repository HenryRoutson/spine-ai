"use client"

import { useMemo } from "react"
import { segmentPipeline } from "@/lib/pipeline-layout"
import { formatRunErrorForDisplay, pipelineRunError } from "@/lib/run-errors"
import { useCyclingWaitPhrase } from "@/lib/inference-wait-phrases"
import type { StepUiState } from "@/lib/run-engine"
import type { ModuleId, PipelineModule, PipelineRun } from "@/lib/types"
import type { ClientStepSpec } from "@/lib/run-types"

import { RunPhase } from "@/lib/run-phase"

type UseRunProgressUiArgs = {
  modules: PipelineModule[]
  phase: RunPhase
  stepStates: Map<ModuleId, StepUiState>
  run: PipelineRun | null
  pendingHumanReview: ClientStepSpec | null
  pendingChatbot?: ClientStepSpec | null
}

export function useRunProgressUi({
  modules,
  phase,
  stepStates,
  run,
  pendingHumanReview,
  pendingChatbot = null,
}: UseRunProgressUiArgs) {
  const progressPct = useMemo(() => {
    if (phase === RunPhase.Idle) return 0
    if (phase === RunPhase.Done) return 100
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
        const parseUi = seg.parse ? stepStates.get(seg.parse.id) : undefined
        if (combineUi?.status === "running") hints.push(combineUi.sub?.label ?? seg.combine.label)
        if (inputUi?.status === "running") hints.push(inputUi.sub?.label ?? seg.input.label)
        if (seg.parse && parseUi?.status === "running") hints.push(parseUi.sub?.label ?? seg.parse.label)
        continue
      }
      const moduleUi = stepStates.get(seg.module.id)
      if (moduleUi?.status === "running") hints.push(moduleUi.sub?.label ?? seg.module.label)
    }
    return hints
  }, [stepStates, modules])

  const waitPhrase = useCyclingWaitPhrase(phase === RunPhase.Running, runningHints)
  const runErr = useMemo(() => (run ? pipelineRunError(run) : null), [run])
  const runErrorDisplay = useMemo(() => (run ? formatRunErrorForDisplay(run) : null), [run])
  const runButtonBusy = phase === RunPhase.Running && !pendingHumanReview && !pendingChatbot
  const runButtonLabel =
    pendingHumanReview != null
      ? "Waiting for your review…"
      : pendingChatbot != null
        ? "Waiting for chatbot…"
      : phase === RunPhase.Running
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
