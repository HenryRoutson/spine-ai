"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { computeInvalidForUi } from "@/lib/pipeline-validity-ui"
import { PipelineCanvas } from "@/components/pipeline-canvas"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { ResizableSplit } from "@/components/resizable-split"
import { loggingPipelineCanvasSplit } from "@/lib/layout-split-settings"
import { usePersistedLeadingWidth } from "@/lib/use-persisted-leading-width"
import { findPipelineModule, flattenPipelineModules, forkBranchesOf, isForkKind, locatePipelineModule } from "@/lib/fork-pipeline"
import { combineGroupAt } from "@/lib/pipeline-layout"
import { ModuleKind } from "@/lib/types"
import type { InvalidMap } from "@/lib/validity"
import { stepSpreadsheetJson } from "@/lib/step-doc"
import type { StepUiState } from "@/lib/run-engine"
import type { ModuleId, PipelineModule, PipelineRun, RunStepStatus, StructureModel, TypeAlias } from "@/lib/types"

export function StepExcelSidebar({
  module,
  run,
  stepUi,
  models,
  parts,
  onSelectPart,
}: {
  module?: PipelineModule
  run?: PipelineRun | null
  stepUi?: StepUiState
  models: StructureModel[]
  parts?: { id: ModuleId; label: string }[]
  onSelectPart?: (id: ModuleId) => void
}) {
  const runStep = module ? run?.steps.find((s) => s.moduleId === module.id) : undefined
  const json = runStep ? stepSpreadsheetJson(runStep) : undefined
  const preview = runStep?.outputPreview ?? stepUi?.outputPreview
  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-border bg-card/40">
      <div className="border-b border-border px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Step spreadsheet</p>
        <p className="mt-0.5 text-xs font-medium">{module?.label ?? "Click a step"}</p>
        {parts && parts.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {parts.map((part) => (
              <button
                key={part.id}
                type="button"
                onClick={() => onSelectPart?.(part.id)}
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[9px]",
                  part.id === module?.id
                    ? "border-primary text-foreground"
                    : "border-border text-muted-foreground hover:border-primary hover:text-foreground",
                )}
              >
                {part.label}
              </button>
            ))}
          </div>
        )}
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

function groupParts(modules: PipelineModule[], selected?: PipelineModule): { id: ModuleId; label: string }[] {
  if (!selected) return []
  if (isForkKind(selected.kind)) {
    const parts: { id: ModuleId; label: string }[] = [{ id: selected.id, label: `${selected.label} · join` }]
    for (const b of forkBranchesOf(selected)) {
      for (const m of flattenPipelineModules(b.modules)) {
        parts.push({ id: m.id, label: `${b.label} / ${m.label}` })
      }
    }
    return parts
  }
  if (selected.kind === ModuleKind.Combine) {
    const loc = locatePipelineModule(modules, selected.id)
    const group = loc ? combineGroupAt(loc.siblings, loc.index) : undefined
    if (!group) return [{ id: selected.id, label: selected.label }]
    return [
      { id: group.input.id, label: group.input.label },
      ...(group.convert ? [{ id: group.convert.id, label: group.convert.label }] : []),
      ...(group.parse ? [{ id: group.parse.id, label: group.parse.label }] : []),
      { id: selected.id, label: `${selected.label} · join` },
    ]
  }
  return []
}

export function PipelineRunGraph({
  modules,
  models,
  run,
  stepStates,
  stepStatus,
  invalid,
  typeAliases,
  selectedId: selectedIdProp,
  onSelect,
}: {
  modules: PipelineModule[]
  models: StructureModel[]
  run?: PipelineRun | null
  stepStates?: Map<ModuleId, StepUiState>
  stepStatus?: Map<ModuleId, RunStepStatus>
  invalid?: InvalidMap
  typeAliases?: TypeAlias[]
  selectedId?: ModuleId
  onSelect?: (id: ModuleId) => void
}) {
  const [internalId, setInternalId] = useState<ModuleId | undefined>()
  const selectedId = selectedIdProp ?? internalId
  const setSelectedId = onSelect ?? setInternalId
  const { width, setWidth, commitWidth } = usePersistedLeadingWidth(loggingPipelineCanvasSplit)
  const selected = selectedId ? findPipelineModule(modules, selectedId) : undefined
  useEffect(() => {
    if (selectedId && !findPipelineModule(modules, selectedId)) {
      if (!onSelect) setInternalId(undefined)
    }
  }, [modules, selectedId, onSelect])
  const status = useMemo(() => {
    const map = new Map<ModuleId, RunStepStatus>()
    for (const step of run?.steps ?? []) map.set(step.moduleId, step.status)
    if (stepStates) {
      for (const [id, ui] of stepStates) {
        if (ui.status === "error" || ui.status === "ok" || ui.status === "cached") map.set(id, ui.status)
      }
    }
    if (stepStatus) {
      for (const [id, s] of stepStatus) map.set(id, s)
    }
    return map
  }, [run, stepStatus, stepStates])
  const invalidMap = useMemo(
    () => invalid ?? computeInvalidForUi(modules, models, typeAliases ?? []),
    [invalid, modules, models, typeAliases],
  )
  const parts = useMemo(() => groupParts(modules, selected), [modules, selected])

  return (
    <ResizableSplit
      className="h-[min(40rem,70vh)] overflow-hidden rounded-lg border border-border bg-card"
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
            invalid={invalidMap}
          />
        </div>
      }
      trailing={
        <StepExcelSidebar
          module={selected}
          run={run}
          stepUi={selectedId ? stepStates?.get(selectedId) : undefined}
          models={models}
          parts={parts}
          onSelectPart={setSelectedId}
        />
      }
    />
  )
}
