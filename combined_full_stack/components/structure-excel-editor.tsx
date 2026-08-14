"use client"
// AI : parity ids — structure.add-field structure.remove-field structure.mark-optional

import { useMemo, useState } from "react"
import { Plus, Trash2, Lock, AlertTriangle } from "lucide-react"
import { useStore, uid } from "@/lib/store"
import {
  FieldType,
  type ModelField,
  type StructureModel,
  type TypeAlias,
} from "@/lib/types"
import { isLockedStructureModel, lockedStructureBanner } from "@/lib/structure"
import { computeStructureIssues, structureIssueMessage } from "@/lib/structure-validity"
import {
  FieldExamplesEditorDialog,
  fieldExamplesSummary,
  formatFieldExamplesSummary,
} from "@/components/field-examples-editor-dialog"
import { StructureFieldTypeEditor } from "@/components/structure-field-type-editor"
import { StructureSourceDocLink } from "@/components/structure-source-doc-link"
import { fieldTypeLabel } from "@/lib/structure-field-labels"
import { fieldIsMapType, fieldIsSetType, fieldToTypeExpr, fieldUsesItemCardinality } from "@/lib/server/type_expr"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { WARNING_TEXT_CLASS } from "@/lib/ui-classes"
import { useLockedInteractFlash } from "@/lib/use-locked-interact-flash"
import { cn } from "@/lib/utils"
import { uiContextTargetProps } from "@/lib/ui-context-dom"

type StructureExcelEditorProps = {
  selectedId: string
  onSelectId: (id: string) => void
}

export function StructureExcelEditor({ selectedId, onSelectId }: StructureExcelEditorProps) {
  const { models, setModels, typeAliases, project } = useStore()
  const teamReadOnly = !!project?.teamReadOnly
  const selected = models.find((m) => m.id === selectedId) ?? models[0]
  const selectedLocked = teamReadOnly || (selected ? isLockedStructureModel(selected) : false)
  const lockMessage = teamReadOnly
    ? "Read-only team project — you can view and run, but not edit structures."
    : selected
      ? lockedStructureBanner(selected)
      : null
  const { flash: lockFlash, bannerRef: lockBannerRef, notifyLocked } = useLockedInteractFlash(
    lockMessage,
    selectedId,
  )
  const selectedIssues = useMemo(() => {
    if (!selected) return []
    return computeStructureIssues(models, typeAliases).filter((i) => i.modelId === selected.id)
  }, [models, typeAliases, selected])

  function updateModel(next: StructureModel) {
    if (teamReadOnly || isLockedStructureModel(next)) return
    setModels(models.map((m) => (m.id === next.id ? next : m)))
  }

  function deleteModel(id: string) {
    if (teamReadOnly) return
    const target = models.find((m) => m.id === id)
    if (target && isLockedStructureModel(target)) return
    const next = models.filter((m) => m.id !== id)
    setModels(next)
    if (selectedId === id) onSelectId(next[0]?.id ?? "")
  }

  function addField() {
    if (!selected) return
    updateModel({
      ...selected,
      fields: [
        ...selected.fields,
        { id: uid(), name: "field", type: FieldType.Text, optional: false, description: "" },
      ],
    })
  }

  function updateField(fieldId: string, patch: Partial<ModelField>) {
    if (!selected) return
    updateModel({
      ...selected,
      fields: selected.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
    })
  }

  function removeField(fieldId: string) {
    if (!selected) return
    updateModel({
      ...selected,
      fields: selected.fields.filter((f) => f.id !== fieldId),
    })
  }

  if (!selected) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-xs text-muted-foreground">No structure selected — add one in the sidebar.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[oklch(0.16_0.004_264)]">
      {/* AI : model title row — spreadsheet header band */}
      <div className="shrink-0 border-b border-border bg-secondary/30 px-4 py-3">
        {selectedLocked && lockMessage && (
          <div
            ref={lockBannerRef}
            role={lockFlash ? "alert" : "status"}
            className={cn(
              "mb-2 flex items-start gap-2 rounded-md border px-3 py-2 font-mono text-[11px] transition-colors",
              lockFlash
                ? "border-destructive/50 bg-destructive/15 text-destructive"
                : "border-border bg-secondary/40 text-muted-foreground",
            )}
          >
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{lockMessage}</span>
          </div>
        )}
        {selected.sourceDocId && (
          <div className="mb-2">
            <StructureSourceDocLink sourceDocId={selected.sourceDocId} />
          </div>
        )}
        {selectedIssues.length > 0 && (
          <div className="mb-2 space-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
            {selectedIssues.map((issue, i) => (
              <p key={i} className="font-mono text-[11px] text-destructive">
                {structureIssueMessage(issue, models)}
              </p>
            ))}
          </div>
        )}
        {selected.fields.length === 0 && (
          <div className={cn("mb-2 flex items-center gap-2 text-[11px]", WARNING_TEXT_CLASS)}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Add at least one row before using this structure in a pipeline
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <input
              value={selected.name}
              onChange={(e) => updateModel({ ...selected, name: e.target.value })}
              readOnly={selectedLocked}
              onPointerDown={selectedLocked ? notifyLocked : undefined}
              onFocus={selectedLocked ? notifyLocked : undefined}
              placeholder="Structure name"
              className="w-full border-0 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground read-only:cursor-not-allowed"
            />
            <input
              value={selected.description}
              onChange={(e) => updateModel({ ...selected, description: e.target.value })}
              readOnly={selectedLocked}
              onPointerDown={selectedLocked ? notifyLocked : undefined}
              onFocus={selectedLocked ? notifyLocked : undefined}
              placeholder="What does this structure represent?"
              className="w-full border-0 bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/70 read-only:cursor-not-allowed"
            />
          </div>
          {models.length > 1 && !selectedLocked && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => deleteModel(selected.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* AI : spreadsheet grid */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[860px] border-collapse text-[11.5px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-secondary/80 backdrop-blur-sm">
              <th className="w-9 border-b border-r border-border px-1 py-1.5 text-center text-[10px] font-medium text-muted-foreground">
                #
              </th>
              <th className="min-w-[140px] border-b border-r border-border px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Field name
              </th>
              <th className="min-w-[150px] border-b border-r border-border px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Data type
              </th>
              <th className="min-w-[180px] border-b border-r border-border px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Description
              </th>
              <th className="min-w-[130px] border-b border-r border-border px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Examples
              </th>
              <th className="w-20 border-b border-r border-border px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Min–Max
              </th>
              <th className="w-20 border-b border-r border-border px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Required
              </th>
              <th
                className="w-14 border-b border-r border-border px-1 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                title="= exact in tests · ≈ probabilistic (ignored)"
              >
                Det
              </th>
              <th
                className="w-14 border-b border-r border-border px-1 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                title="± tolerance on int/float compare"
              >
                ±
              </th>
              <th className="w-10 border-b border-border px-1 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {selected.fields.map((f, rowIdx) => (
              <FieldRow
                key={f.id}
                field={f}
                fields={selected.fields}
                rowIdx={rowIdx}
                locked={selectedLocked}
                models={models}
                typeAliases={typeAliases}
                selectedId={selected.id}
                onLockedInteract={notifyLocked}
                onUpdate={(patch) => updateField(f.id, patch)}
                onRemove={() => removeField(f.id)}
              />
            ))}
          </tbody>
        </table>

        {!selectedLocked && (
          <div className="border-t border-border px-3 py-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addField} spineId="structure.add-field">
              <Plus className="mr-1 h-3.5 w-3.5" /> Add row
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

type FieldRowProps = {
  field: ModelField
  fields: ModelField[]
  rowIdx: number
  locked: boolean
  models: StructureModel[]
  typeAliases: TypeAlias[]
  selectedId: string
  onLockedInteract: () => void
  onUpdate: (patch: Partial<ModelField>) => void
  onRemove: () => void
}

function FieldRow({
  field,
  fields,
  rowIdx,
  locked,
  models,
  typeAliases,
  selectedId,
  onLockedInteract,
  onUpdate,
  onRemove,
}: FieldRowProps) {
  const stripe = rowIdx % 2 === 1
  const isNumeric = field.type === FieldType.Int || field.type === FieldType.Float
  const expr = fieldToTypeExpr(field)
  const isText = field.type === FieldType.Text || (expr.kind === "prim" && expr.name === "text")
  const isSet = fieldIsSetType(field)
  const isMap = fieldIsMapType(field)
  const showsCardinality = isText || fieldUsesItemCardinality(field)
  const minKey = isText ? "minLength" : "minItems"
  const maxKey = isText ? "maxLength" : "maxItems"
  const minTitle = isText
    ? "minimum string length"
    : isSet
      ? "minimum set size"
      : isMap
        ? "minimum map entries"
        : "minimum list length"
  const maxTitle = isText
    ? "maximum string length"
    : isSet
      ? "maximum set size"
      : isMap
        ? "maximum map entries"
        : "maximum list length"
  const toleranceEnabled = isNumeric && field.deterministic !== false
  const [examplesOpen, setExamplesOpen] = useState(false)
  const exampleStats = useMemo(
    () => fieldExamplesSummary(field, models, typeAliases),
    [field, models, typeAliases],
  )

  return (
    <>
      <tr
        className={cn("group", stripe && "bg-secondary/15")}
        {...uiContextTargetProps({
          kind: "inspector_field",
          id: `field:${selectedId}:${field.name || field.id}`,
          label: `Field · ${field.name || "unnamed"}`,
          fieldPath: field.name || field.id,
          snippet: [
            // AI : label the FieldType enum — not the whole ModelField object.
            fieldTypeLabel(field.type),
            field.optional ? "optional" : "required",
            field.description?.trim() || null,
            formatFieldExamplesSummary(exampleStats.positive, exampleStats.negative) || null,
          ]
            .filter(Boolean)
            .join(" · "),
        })}
      >
        <td className="border-b border-r border-border bg-secondary/25 px-1 py-0 text-center text-[10px] text-muted-foreground">
          {rowIdx + 1}
        </td>
        <td className="border-b border-r border-border p-0">
          <CellInput
            value={field.name}
            onChange={(v) => onUpdate({ name: v })}
            placeholder="e.g. Company name"
            locked={locked}
            onLockedInteract={onLockedInteract}
          />
        </td>
        <td className="border-b border-r border-border p-0 align-top">
          {/* AI : disabled Select swallows clicks — catch on the cell wrapper. */}
          <div
            className={cn("px-1 py-1", locked && "cursor-not-allowed")}
            onPointerDown={locked ? onLockedInteract : undefined}
          >
            <div className={cn(locked && "pointer-events-none")}>
              <StructureFieldTypeEditor
                field={field}
                fields={fields}
                models={models}
                selectedId={selectedId}
                locked={locked}
                onUpdate={onUpdate}
              />
            </div>
          </div>
        </td>
        <td className="border-b border-r border-border p-0">
          <CellInput
            value={field.description}
            onChange={(v) => onUpdate({ description: v })}
            placeholder="What should go here?"
            locked={locked}
            onLockedInteract={onLockedInteract}
          />
        </td>
        <td className="border-b border-r border-border p-0">
          <button
            type="button"
            onClick={() => setExamplesOpen(true)}
            className={cn(
              "flex h-8 w-full items-center px-2 text-left text-[11px] outline-none transition-colors hover:bg-secondary/40",
              exampleStats.hasInvalid && "text-destructive",
              exampleStats.positive + exampleStats.negative === 0 && "text-muted-foreground",
            )}
            title={
              exampleStats.hasInvalid
                ? "Some examples do not match the field type"
                : "Edit valid and negative examples"
            }
          >
            <span className="truncate">
              {formatFieldExamplesSummary(exampleStats.positive, exampleStats.negative)}
            </span>
          </button>
          <FieldExamplesEditorDialog
            open={examplesOpen}
            onClose={() => setExamplesOpen(false)}
            field={field}
            models={models}
            typeAliases={typeAliases}
            locked={locked}
            onUpdate={onUpdate}
          />
        </td>
        <td className="border-b border-r border-border p-0 text-center">
          {showsCardinality ? (
            <div
              className="flex h-8 items-center justify-center gap-0.5 px-0.5"
              onPointerDown={locked ? onLockedInteract : undefined}
            >
              <input
                type="number"
                min={1}
                step={1}
                value={field[minKey] ?? ""}
                placeholder="min"
                disabled={locked}
                title={minTitle}
                onChange={(e) => {
                  const raw = e.target.value.trim()
                  if (!raw) {
                    onUpdate({ [minKey]: undefined })
                    return
                  }
                  const n = Number(raw)
                  onUpdate({ [minKey]: Number.isFinite(n) && n >= 1 ? n : undefined })
                }}
                className={cn(
                  "h-6 w-9 rounded border bg-transparent px-0.5 text-center font-mono text-[10px] outline-none",
                  field[minKey] !== undefined ? "border-output/50 text-output" : "border-border text-muted-foreground",
                  locked && "pointer-events-none cursor-not-allowed opacity-70",
                )}
              />
              <input
                type="number"
                min={1}
                step={1}
                value={field[maxKey] ?? ""}
                placeholder="max"
                disabled={locked}
                title={maxTitle}
                onChange={(e) => {
                  const raw = e.target.value.trim()
                  if (!raw) {
                    onUpdate({ [maxKey]: undefined })
                    return
                  }
                  const n = Number(raw)
                  onUpdate({ [maxKey]: Number.isFinite(n) && n >= 1 ? n : undefined })
                }}
                className={cn(
                  "h-6 w-9 rounded border bg-transparent px-0.5 text-center font-mono text-[10px] outline-none",
                  field[maxKey] !== undefined ? "border-output/50 text-output" : "border-border text-muted-foreground",
                  locked && "pointer-events-none cursor-not-allowed opacity-70",
                )}
              />
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">—</span>
          )}
        </td>
        <td className="border-b border-r border-border p-0 text-center">
          <div
            className="flex h-8 items-center justify-center"
            onPointerDown={locked ? onLockedInteract : undefined}
          >
            <div className={cn(locked && "pointer-events-none")}>
              <Switch
                size="sm"
                checked={!field.optional}
                disabled={locked}
                onCheckedChange={(checked) => onUpdate({ optional: !checked })}
                title={field.optional ? "Optional" : "Required"}
                aria-label={field.optional ? "Mark required" : "Mark optional"}
                data-spine-id="structure.mark-optional"
              />
            </div>
          </div>
        </td>
        <td className="border-b border-r border-border p-0 text-center">
          {/* AI : deterministic flag — "=" exact in tests, "≈" probabilistic (ignored) */}
          <div
            className="flex h-8 items-center justify-center"
            onPointerDown={locked ? onLockedInteract : undefined}
          >
            <button
              type="button"
              disabled={locked}
              onClick={() => onUpdate({ deterministic: field.deterministic === false ? undefined : false })}
              title={
                field.deterministic === false
                  ? "probabilistic — tests ignore this field"
                  : "deterministic — tests exact-compare this field"
              }
              className={cn(
                "mx-auto flex h-6 w-7 items-center justify-center rounded text-[11px] font-medium transition-colors",
                field.deterministic === false
                  ? "bg-chart-3/15 text-chart-3"
                  : "bg-secondary text-muted-foreground",
                locked && "pointer-events-none cursor-not-allowed opacity-70",
              )}
            >
              {field.deterministic === false ? "≈" : "="}
            </button>
          </div>
        </td>
        <td className="border-b border-r border-border p-0 text-center">
          {toleranceEnabled ? (
            <div
              className="flex h-8 items-center justify-center"
              onPointerDown={locked ? onLockedInteract : undefined}
            >
              <input
                type="number"
                min={0}
                step={1}
                value={field.testTolerance ?? ""}
                placeholder="±"
                disabled={locked}
                title="test tolerance — ± on int/float compare"
                onChange={(e) => {
                  const raw = e.target.value.trim()
                  if (!raw) {
                    onUpdate({ testTolerance: undefined })
                    return
                  }
                  const n = Number(raw)
                  onUpdate({ testTolerance: Number.isFinite(n) && n >= 0 ? n : undefined })
                }}
                className={cn(
                  "mx-auto h-6 w-10 rounded border bg-transparent px-0.5 text-center font-mono text-[10px] outline-none",
                  field.testTolerance !== undefined
                    ? "border-output/50 text-output"
                    : "border-border text-muted-foreground",
                  locked && "pointer-events-none cursor-not-allowed opacity-70",
                )}
              />
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">—</span>
          )}
        </td>
        <td className="border-b border-border p-0 text-center">
          {!locked && (
            <button
              type="button"
              onClick={onRemove}
              data-spine-id="structure.remove-field"
              className="px-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </td>
      </tr>
      {field.type === "json" && !field.typeExpr && (
        <tr className={cn(stripe && "bg-secondary/15")}>
          <td className="border-b border-r border-border bg-secondary/25" />
          <td colSpan={9} className="border-b border-border px-2 py-1 text-[10px] text-amber-700 dark:text-amber-500">
            Flexible data stores anything — prefer &ldquo;{fieldTypeLabel(FieldType.Model)}&rdquo; or a Type from the sidebar.
          </td>
        </tr>
      )}
    </>
  )
}

function CellInput({
  value,
  onChange,
  placeholder,
  locked,
  onLockedInteract,
  mono,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  locked: boolean
  onLockedInteract: () => void
  mono?: boolean
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={locked}
      onPointerDown={locked ? onLockedInteract : undefined}
      onFocus={locked ? onLockedInteract : undefined}
      placeholder={placeholder}
      className={cn(
        "h-8 w-full border-0 bg-transparent px-2 text-[11.5px] outline-none placeholder:text-muted-foreground/50 read-only:cursor-not-allowed",
        mono && "font-mono",
      )}
    />
  )
}
