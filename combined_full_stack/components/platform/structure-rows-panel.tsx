"use client"

import { useMemo, useState } from "react"
import { Plus, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { spineActionProps } from "@/lib/core/parity"
import { useAppShell } from "@/lib/app-shell"
import { AppWindowId } from "@/lib/app-window-id"
import { isVibeWindow } from "@/lib/app-nav-config"
import { useStore } from "@/lib/store"
import { DocLabel, InputType, type StructureModel } from "@/lib/types"
import {
  addStructureRow,
  emptyRowData,
  readProjectRows,
  removeStructureRow,
  rowsForModel,
  updateStructureRow,
  writeProjectRows,
  type project_row_store,
  type structure_row,
  type structure_row_id,
} from "@/lib/platform-row-store"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { feedFileName, feedableInputsForModel, feedRowJson } from "@/lib/platform-feed"
import { compatStatusColor, compatStatusLabel } from "@/lib/platform-type-ports"
import { cn } from "@/lib/utils"

// AI : typed table rows + one-click feed into a compatible pipeline input.
export function StructureRowsPanel({
  models,
  onStoreChange,
}: {
  models: StructureModel[]
  onStoreChange?: (store: project_row_store) => void
}) {
  const { project, modules, typeAliases, addDocContent, inferenceInputDocIds, setInferenceInputDocIds } = useStore()
  const { activeWindow, setActiveWindow, setVibeObserveTab } = useAppShell()
  const userModels = useMemo(() => models.filter((m) => !m.auto), [models])
  const [store, setStore] = useState<project_row_store>(() => readProjectRows(project.id))
  const [selectedId, setSelectedId] = useState<string | null>(userModels[0]?.id ?? null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = userModels.find((m) => m.id === selectedId) ?? userModels[0]
  const rows = selected ? rowsForModel(store, selected.id) : []
  const feedable = selected
    ? feedableInputsForModel(modules, models, typeAliases, selected.id)
    : []

  function persist(next: project_row_store) {
    setStore(next)
    writeProjectRows(project.id, next)
    onStoreChange?.(next)
  }

  function addRow() {
    if (!selected) return
    persist(addStructureRow(store, selected).store)
  }

  function patchRow(row: structure_row, field: string, raw: string) {
    persist(updateStructureRow(store, row.modelId, row.id, { ...row.data, [field]: raw }))
  }

  function deleteRow(id: structure_row_id) {
    if (!selected) return
    persist(removeStructureRow(store, selected.id, id))
  }

  async function feed(row: structure_row, moduleId: (typeof feedable)[number]["moduleId"], inputType: InputType) {
    if (!selected) return
    setBusyId(row.id)
    setError(null)
    try {
      const target = flattenPipelineModules(modules).find((m) => m.id === moduleId)
      const doc = await addDocContent(
        feedFileName(selected.name, row.id),
        inputType,
        feedRowJson(row, target),
        DocLabel.Inference,
        project.id,
      )
      setInferenceInputDocIds({ ...inferenceInputDocIds, [moduleId]: doc.id })
      if (isVibeWindow(activeWindow)) setVibeObserveTab(AppWindowId.Inference)
      else setActiveWindow(AppWindowId.Inference)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not feed row")
    } finally {
      setBusyId(null)
    }
  }

  if (!selected) {
    return <p className="text-xs text-muted-foreground">No structures yet — describe tables in Vibe chat.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {userModels.map((model) => (
          <button
            key={model.id}
            type="button"
            className={cn(
              "rounded-md border px-2 py-1 font-mono text-[11px]",
              model.id === selected.id
                ? "border-border bg-background text-foreground shadow-sm"
                : "border-transparent text-muted-foreground hover:bg-background/70",
            )}
            onClick={() => setSelectedId(model.id)}
            {...spineActionProps("platform.table-select")}
          >
            {model.name}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {rows.length} row{rows.length === 1 ? "" : "s"} in {selected.name}. Compatible pipelines can ingest a row
          because the types match.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          onClick={addRow}
          {...spineActionProps("platform.table-add-row")}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add row
        </Button>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-border bg-card p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {(selected.fields ?? []).map((field) => (
                <label key={field.id} className="space-y-0.5">
                  <span className="font-mono text-[10px] text-muted-foreground">{field.name}</span>
                  <Input
                    className="h-8 font-mono text-xs"
                    value={cellString(row.data[field.name])}
                    onChange={(e) => patchRow(row, field.name, e.target.value)}
                  />
                </label>
              ))}
              {(selected.fields ?? []).length === 0 ? (
                <p className="text-[10px] text-muted-foreground">This structure has no fields yet.</p>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {feedable.map((target) => (
                <Button
                  key={target.moduleId}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 text-[10px]"
                  disabled={busyId === row.id}
                  onClick={() => void feed(row, target.moduleId, target.inputType)}
                  {...spineActionProps("platform.feed-row")}
                >
                  <Zap className="mr-1 h-3 w-3" />
                  Feed → {target.label}
                  <span className={cn("ml-1", compatStatusColor(target.status))}>
                    {compatStatusLabel(target.status)}
                  </span>
                </Button>
              ))}
              {feedable.length === 0 ? (
                <span className="text-[10px] text-muted-foreground">
                  No JSON/text pipeline input matches this type.
                </span>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto h-7 text-[10px] text-destructive"
                onClick={() => deleteRow(row.id)}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Empty table. Add a row, then click Feed to run the matching pipeline.
        </p>
      ) : null}
    </div>
  )
}

function cellString(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return ""
  }
}

export function seedEmptyRowPreview(model: StructureModel): Record<string, unknown> {
  return emptyRowData(model)
}
