"use client"

import { useEffect, useMemo, useState } from "react"
import { PipelineCanvas } from "@/components/pipeline-canvas"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { ResizableSplit } from "@/components/resizable-split"
import { loggingPipelineCanvasSplit } from "@/lib/layout-split-settings"
import { usePersistedLeadingWidth } from "@/lib/use-persisted-leading-width"
import { findPipelineModule } from "@/lib/fork-pipeline"
import { stepSpreadsheetJson } from "@/lib/step-doc"
import type { StepUiState } from "@/lib/run-engine"
import type { ModuleId, PipelineModule, PipelineRun, RunStepStatus, StructureModel } from "@/lib/types"

export function StepExcelSidebar({
  module,
  run,
  stepUi,
  models,
}: {
  module?: PipelineModule
  run?: PipelineRun | null
  stepUi?: StepUiState
  models: StructureModel[]
}) {
  const runStep = module ? run?.steps.find((s) => s.moduleId === module.id) : undefined
  const json = runStep ? stepSpreadsheetJson(runStep) : undefined
  const preview = runStep?.outputPreview ?? stepUi?.outputPreview
  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-border bg-card/40">
      <div className="border-b border-border px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Step spreadsheet</p>
        <p className="mt-0.5 text-xs font-medium">{module?.label ?? "Click a step"}</p>
      </div>
      {!module ? (
        <p className="px-3 py-4 font-mono text-[11px] text-muted-foreground">
          Click a step on the graph to see its table.
        </p>
      ) : json ? (
        <JsonPreviewPanel json={json} models={models} excelOnly className="min-h-[18rem] flex-1" downloadBaseName={module.label} />
      ) : (
        <p className="whitespace-pre-wrap px-3 py-4 font-mono text-[11px] text-muted-foreground">
          {preview?.trim() || "No table output for this step yet."}
        </p>
      )}
    </aside>
  )
}

export function PipelineRunGraph({
  modules,
  models,
  run,
  stepStates,
  stepStatus,
}: {
  modules: PipelineModule[]
  models: StructureModel[]
  run?: PipelineRun | null
  stepStates?: Map<ModuleId, StepUiState>
  stepStatus?: Map<ModuleId, RunStepStatus>
}) {
  const [selectedId, setSelectedId] = useState<ModuleId | undefined>()
  const { width, setWidth, commitWidth } = usePersistedLeadingWidth(loggingPipelineCanvasSplit)
  const selected = selectedId ? findPipelineModule(modules, selectedId) : undefined
  useEffect(() => {
    if (selectedId && !findPipelineModule(modules, selectedId)) setSelectedId(undefined)
  }, [modules, selectedId])
  const status = useMemo(() => {
    if (stepStatus) return stepStatus
    const map = new Map<ModuleId, RunStepStatus>()
    for (const step of run?.steps ?? []) map.set(step.moduleId, step.status)
    return map
  }, [run, stepStatus])

  return (
    <ResizableSplit
      className="h-[28rem] overflow-hidden rounded-lg border border-border bg-card"
      leadingWidth={width}
      onLeadingWidthChange={setWidth}
      onLeadingWidthCommit={commitWidth}
      minLeading={loggingPipelineCanvasSplit.min}
      maxLeading={loggingPipelineCanvasSplit.max}
      leading={
        <div className="h-full min-h-0 overflow-auto px-4 py-6">
          <PipelineCanvas
            modules={modules}
            models={models}
            selectedId={selectedId}
            onSelect={setSelectedId}
            stepStatus={status}
          />
        </div>
      }
      trailing={
        <StepExcelSidebar
          module={selected}
          run={run}
          stepUi={selectedId ? stepStates?.get(selectedId) : undefined}
          models={models}
        />
      }
    />
  )
}
