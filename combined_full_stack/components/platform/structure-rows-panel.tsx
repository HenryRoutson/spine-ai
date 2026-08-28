"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { spineActionProps } from "@/lib/core/parity"
import { useAppShell } from "@/lib/app-shell"
import { AppWindowId } from "@/lib/app-window-id"
import { isVibeWindow } from "@/lib/app-nav-config"
import { useStore } from "@/lib/store"
import { DocLabel, FieldType, InputType, type ModelField, type StructureModel, type StructureModelId } from "@/lib/types"
import {
  addStructureRow,
  emptyRowData,
  migrateLocalRowsIfNeeded,
  removeStructureRow,
  rowsForModel,
  rowsStoreForProject,
  updateStructureRow,
  writeProjectRows,
  type project_row_store,
  type structure_row,
  type structure_row_id,
} from "@/lib/platform-row-store"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { feedFileName, feedableInputsForModel, feedRowJson } from "@/lib/platform-feed"
import { compatStatusColor, compatStatusLabel } from "@/lib/platform-type-ports"
import { fieldTypeLabel } from "@/lib/structure-field-labels"
import {
  asList,
  displayScalar,
  emptyListHint,
  fieldIsList,
  friendlyFieldName,
  jsonFieldDisplay,
  nestedModelIdForField,
  newListItem,
  parseJsonField,
  parseScalarField,
  listItemNoun,
} from "@/lib/platform-row-fields"
import { cn } from "@/lib/utils"

const NEST_DEPTH_MAX = 3

// AI : typed table rows + one-click send into a compatible pipeline input.
export function StructureRowsPanel({
  models,
  lockModelId,
  onStoreChange,
}: {
  models: StructureModel[]
  lockModelId?: StructureModelId
  onStoreChange?: (store: project_row_store) => void
}) {
  const { project, modules, typeAliases, addDocContent, inferenceInputDocIds, setInferenceInputDocIds, patchProject } =
    useStore()
  const { activeWindow, setActiveWindow, setVibeObserveTab } = useAppShell()
  const userModels = useMemo(() => models.filter((m) => !m.auto), [models])
  const [selectedId, setSelectedId] = useState<string | null>(lockModelId ?? userModels[0]?.id ?? null)

  useEffect(() => {
    const migrated = migrateLocalRowsIfNeeded(project)
    if (!migrated) return
    patchProject({ structureRows: migrated })
  }, [project.id, project.structureRows, patchProject])

  const store = rowsStoreForProject(project)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = lockModelId
    ? models.find((m) => m.id === lockModelId) ?? userModels[0]
    : userModels.find((m) => m.id === selectedId) ?? userModels[0]
  const rows = selected ? rowsForModel(store, selected.id) : []
  const feedable = selected
    ? feedableInputsForModel(modules, models, typeAliases, selected.id)
    : []

  function persist(next: project_row_store) {
    writeProjectRows(project.id, next)
    patchProject({ structureRows: next })
    onStoreChange?.(next)
  }

  function addRow() {
    if (!selected) return
    persist(addStructureRow(store, selected).store)
  }

  function patchRow(row: structure_row, field: string, value: unknown) {
    persist(updateStructureRow(store, row.modelId, row.id, { ...row.data, [field]: value }))
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
      setError(e instanceof Error ? e.message : "Could not send this row")
    } finally {
      setBusyId(null)
    }
  }

  if (!selected) {
    return <p className="text-xs text-muted-foreground">No tables yet — describe them in Vibe chat or Structures.</p>
  }

  return (
    <div className="space-y-3">
      {!lockModelId ? (
      <div className="flex flex-wrap gap-1">
        {userModels.map((model) => (
          <button
            key={model.id}
            type="button"
            className={cn(
              "rounded-md border px-2 py-1 text-[11px]",
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
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {rows.length} record{rows.length === 1 ? "" : "s"} in {selected.name}. Matching pipeline steps can take a
          record because the types line up.
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
          Add record
        </Button>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-border bg-card p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {(selected.fields ?? []).map((field) => (
                <RowFieldInput
                  key={field.id}
                  field={field}
                  value={row.data[field.name]}
                  models={models}
                  depth={0}
                  onChange={(value) => patchRow(row, field.name, value)}
                />
              ))}
              {(selected.fields ?? []).length === 0 ? (
                <p className="text-[10px] text-muted-foreground">This table has no columns yet.</p>
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
                  Send to {target.label}
                  <span className={cn("ml-1", compatStatusColor(target.status))}>
                    {compatStatusLabel(target.status)}
                  </span>
                </Button>
              ))}
              {feedable.length === 0 ? (
                <span className="text-[10px] text-muted-foreground">
                  No function input uses this type yet — pick it as a step on Pipeline.
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
          This table is empty. Add a record, then send it to a matching pipeline step.
        </p>
      ) : null}
    </div>
  )
}

function RowFieldInput({
  field,
  value,
  models,
  depth,
  onChange,
}: {
  field: ModelField
  value: unknown
  models: StructureModel[]
  depth: number
  onChange: (value: unknown) => void
}) {
  const label = friendlyFieldName(field.name)
  const hint = field.description?.trim() || fieldTypeLabel(field.type)
  const spanFull = fieldIsList(field) || field.type === FieldType.Json || field.type === FieldType.Model

  return (
    <label className={cn("space-y-0.5", spanFull && "sm:col-span-2")}>
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <FieldControl field={field} value={value} models={models} depth={depth} hint={hint} onChange={onChange} />
    </label>
  )
}

function FieldControl({
  field,
  value,
  models,
  depth,
  hint,
  onChange,
}: {
  field: ModelField
  value: unknown
  models: StructureModel[]
  depth: number
  hint: string
  onChange: (value: unknown) => void
}) {
  if (depth >= NEST_DEPTH_MAX) {
    return (
      <textarea
        className="min-h-16 w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-xs"
        placeholder={hint}
        value={jsonFieldDisplay(value)}
        onChange={(e) => onChange(parseJsonField(e.target.value))}
      />
    )
  }

  if (fieldIsList(field)) {
    return <ListFieldEditor field={field} value={value} models={models} depth={depth} onChange={onChange} />
  }

  if (field.type === FieldType.Bool) {
    const yes = value === true
    const unset = value == null
    return (
      <button
        type="button"
        className={cn(
          "flex h-8 items-center rounded-md border px-2 text-xs",
          yes ? "border-border bg-background" : "border-dashed border-border text-muted-foreground",
        )}
        onClick={() => {
          // AI : cycle Yes → No → (optional Not set) so we never dump "false" as raw text.
          if (yes) onChange(false)
          else if (!unset && field.optional) onChange(null)
          else onChange(true)
        }}
      >
        {yes ? "Yes" : field.optional && unset ? "Not set" : "No"}
      </button>
    )
  }

  if (field.type === FieldType.Json) {
    return (
      <textarea
        className="min-h-16 w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-xs"
        placeholder={hint}
        value={jsonFieldDisplay(value)}
        onChange={(e) => onChange(parseJsonField(e.target.value))}
      />
    )
  }

  if (field.type === FieldType.Model) {
    const nestedId = nestedModelIdForField(field)
    const nested = nestedId ? models.find((m) => m.id === nestedId) : undefined
    const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
    if (!nested) {
      return (
        <textarea
          className="min-h-16 w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-xs"
          placeholder={hint}
          value={jsonFieldDisplay(value)}
          onChange={(e) => onChange(parseJsonField(e.target.value))}
        />
      )
    }
    return (
      <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-2">
        {nested.fields.map((child) => (
          <RowFieldInput
            key={child.id}
            field={child}
            value={record[child.name]}
            models={models}
            depth={depth + 1}
            onChange={(next) => onChange({ ...record, [child.name]: next })}
          />
        ))}
      </div>
    )
  }

  const number = field.type === FieldType.Int || field.type === FieldType.Float
  return (
    <Input
      className="h-8 text-xs"
      type={number ? "number" : "text"}
      step={field.type === FieldType.Float ? "any" : undefined}
      placeholder={hint}
      value={displayScalar(value)}
      onChange={(e) => onChange(number || field.type === FieldType.Bool ? parseScalarField(field, e.target.value) : e.target.value)}
    />
  )
}

function ListFieldEditor({
  field,
  value,
  models,
  depth,
  onChange,
}: {
  field: ModelField
  value: unknown
  models: StructureModel[]
  depth: number
  onChange: (value: unknown) => void
}) {
  const items = asList(value)
  const nestedId = nestedModelIdForField(field)
  const nested = nestedId ? models.find((m) => m.id === nestedId) : undefined

  function setItem(index: number, next: unknown) {
    onChange(items.map((item, i) => (i === index ? next : item)))
  }

  function removeAt(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-2 py-2 text-[11px] text-muted-foreground">
          {emptyListHint(field)}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="rounded-md border border-border/70 bg-background p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {nested?.name ?? friendlyFieldName(field.name)} {index + 1}
                </span>
                <Button type="button" size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => removeAt(index)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {nested ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {nested.fields.map((child) => (
                    <RowFieldInput
                      key={child.id}
                      field={child}
                      value={item && typeof item === "object" ? (item as Record<string, unknown>)[child.name] : undefined}
                      models={models}
                      depth={depth + 1}
                      onChange={(next) => {
                        const record =
                          item && typeof item === "object" && !Array.isArray(item)
                            ? { ...(item as Record<string, unknown>) }
                            : emptyRowData(nested)
                        setItem(index, { ...record, [child.name]: next })
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Input
                  className="h-8 text-xs"
                  placeholder={fieldTypeLabel(field.type)}
                  value={displayScalar(item)}
                  onChange={(e) => setItem(index, e.target.value)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-[11px]"
        onClick={() => onChange([...items, newListItem(field, models)])}
      >
        <Plus className="mr-1 h-3 w-3" />
        Add {listItemNoun(field)}
      </Button>
    </div>
  )
}

export function seedEmptyRowPreview(model: StructureModel): Record<string, unknown> {
  return emptyRowData(model)
}
