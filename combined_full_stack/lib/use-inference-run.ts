"use client"

// AI : composes use-inference-docs + use-inference-run-progress.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { flattenInputDocIds } from "@/lib/inference-input"
import { migrateProjectModules } from "@/lib/quote-steps"
import { useInferenceDocs } from "@/lib/use-inference-docs"
import { useInferenceRunProgress, type InferencePhase } from "@/lib/use-inference-run-progress"
import { buildRunConfigPayload, findMatchingRunClient, stableJson } from "@/lib/run-fingerprint"
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

  const configResetKey = useMemo(() => {
    const migrated = migrateProjectModules({
      ...project,
      modules,
      typeAliases: project.typeAliases ?? [],
    })
    return stableJson({
      cfg: buildRunConfigPayload(migrated, model as ModelId),
      inputs: docsState.inputDocIdsKey,
    })
  }, [project, modules, model, docsState.inputDocIdsKey])

  const [matchingPriorRun, setMatchingPriorRun] = useState<PipelineRun | null>(null)

  // AI : fingerprint match — offer "view log" when this exact setup already completed successfully.
  useEffect(() => {
    if (!docsState.allInputsReady || docsState.inputsInvalid) {
      setMatchingPriorRun(null)
      return
    }
    const inputDocIds = flattenInputDocIds(docsState.inputModules, docsState.inputDocs)
    const migrated = migrateProjectModules({
      ...project,
      modules,
      typeAliases: project.typeAliases ?? [],
    })
    let cancelled = false
    void findMatchingRunClient(runs, migrated, model as ModelId, inputDocIds).then((match) => {
      if (cancelled) return
      setMatchingPriorRun(match)
    })
    return () => {
      cancelled = true
    }
  }, [configResetKey, docsState.allInputsReady, docsState.inputsInvalid, docsState.inputDocs, docsState.inputModules, model, modules, project, runs])

  const progress = useInferenceRunProgress({
    projectId: project.id as ProjectId,
    modules,
    model,
    configResetKey,
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

  return { ...docsState, ...progress, matchingPriorRun }
}
