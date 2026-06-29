"use client"

// AI : composes use-inference-docs + use-inference-run-progress.
import { useCallback, useRef } from "react"
import { useInferenceDocs } from "@/lib/use-inference-docs"
import { useInferenceRunProgress, type InferencePhase } from "@/lib/use-inference-run-progress"
import type { DocId, DocRef, ModelId, ModuleId, PipelineModule, PipelineRun, Project, ProjectId } from "@/lib/types"

export type { InferencePhase }

type UseInferenceRunArgs = {
  project: Project
  modules: PipelineModule[]
  model: string
  docs: DocRef[]
  runs: PipelineRun[]
  inferenceInputDocIds: Partial<Record<ModuleId, DocId | DocId[]>>
  setInferenceInputDocIds: (docs: Partial<Record<ModuleId, DocId | DocId[]>>) => void
  addRun: (r: PipelineRun) => void
  updateRunNotes: (runId: PipelineRun["id"], notes: string | undefined) => Promise<void>
  refreshBilling: () => Promise<void>
  flushPendingSave?: () => Promise<void>
}

export function useInferenceRun({
  project,
  modules,
  model,
  docs,
  runs,
  inferenceInputDocIds,
  setInferenceInputDocIds,
  addRun,
  updateRunNotes,
  refreshBilling,
  flushPendingSave,
}: UseInferenceRunArgs) {
  const resetRunOnSwitchRef = useRef<() => void>(() => {})
  const onProjectSwitch = useCallback(() => {
    resetRunOnSwitchRef.current()
  }, [])

  const docsState = useInferenceDocs({
    project,
    modules,
    docs,
    inferenceInputDocIds,
    setInferenceInputDocIds,
    onProjectSwitch,
  })

  const progress = useInferenceRunProgress({
    projectId: project.id as ProjectId,
    modules,
    model,
    inputModules: docsState.inputModules,
    inputDocs: docsState.inputDocs,
    allInputsReady: docsState.allInputsReady,
    inputsInvalid: docsState.inputsInvalid,
    runs,
    addRun,
    updateRunNotes,
    refreshBilling,
    flushPendingSave,
  })

  resetRunOnSwitchRef.current = progress.resetRunState

  return { ...docsState, ...progress }
}
