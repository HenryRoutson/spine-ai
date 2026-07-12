"use client"

import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { CircleCheck, CircleX, Pencil, Plus, X } from "lucide-react"
import {
  fieldExampleSchemaContext,
  fieldExampleSchemaHint,
  fieldExampleUsesJsonEntry,
} from "@/lib/field-example-schema-hint"
import {
  fieldExampleJsonSchema,
  validateFieldExampleString,
  validateFieldExampleStringDraft,
  validateNegativeFieldExampleString,
  validateNegativeFieldExampleStringDraft,
} from "@/lib/server/field_example_validity"
import { JsonLikeHighlight } from "@/components/field-example-json-input"
import { SchemaJsonEditor } from "@/components/schema-json-editor"
import { stablePrettyJsonForEdit } from "@/lib/deep_equal"
import { tryParseJson } from "@/lib/json-utils"
import { defaultFromSchema, jsonSchemaToFormRoot } from "@/lib/schema-form"
import { normalizeModelField } from "@/lib/server/type_expr"
import { fieldTypeLabel } from "@/lib/structure-field-labels"
import type { ModelField, StructureModel, TypeAlias } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FieldExamplesEditorDialogProps = {
  open: boolean
  onClose: () => void
  field: ModelField
  models: StructureModel[]
  typeAliases: TypeAlias[]
  locked: boolean
  onUpdate: (patch: Pick<ModelField, "examples" | "negativeExamples">) => void
}

export function fieldExamplesSummary(
  field: ModelField,
  models: StructureModel[],
  typeAliases: TypeAlias[],
): { positive: number; negative: number; hasInvalid: boolean } {
  const normalized = normalizeModelField(field)
  const positive = normalized.examples?.length ?? 0
  const negative = normalized.negativeExamples?.length ?? 0
  const hasInvalid =
    (normalized.examples ?? []).some(
      (item) => !validateFieldExampleString(item, normalized, models, typeAliases).ok,
    ) ||
    (normalized.negativeExamples ?? []).some(
      (item) => !validateNegativeFieldExampleString(item, normalized, models, typeAliases).ok,
    )
  return { positive, negative, hasInvalid }
}

export function formatFieldExamplesSummary(positive: number, negative: number): string {
  if (positive === 0 && negative === 0) return "Add examples"
  const parts: string[] = []
  if (positive > 0) parts.push(`${positive} example${positive === 1 ? "" : "s"}`)
  if (negative > 0) parts.push(`${negative} negative`)
  return parts.join(" · ")
}

export function FieldExamplesEditorDialog({
  open,
  onClose,
  field,
  models,
  typeAliases,
  locked,
  onUpdate,
}: FieldExamplesEditorDialogProps) {
  const normalizedField = useMemo(() => normalizeModelField(field), [field])
  const schemaHint = useMemo(
    () => fieldExampleSchemaHint(normalizedField, models, typeAliases),
    [normalizedField, models, typeAliases],
  )
  const schemaContext = useMemo(
    () => fieldExampleSchemaContext(normalizedField, models, typeAliases),
    [normalizedField, models, typeAliases],
  )
  const jsonSchema = useMemo(
    () => fieldExampleJsonSchema(normalizedField, models, typeAliases),
    [normalizedField, models, typeAliases],
  )
  const usesJsonEntry = fieldExampleUsesJsonEntry(schemaContext.expr)
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="field-examples-title"
        className="relative flex max-h-[min(90vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="shrink-0 border-b border-border px-4 py-3">
          <h2 id="field-examples-title" className="text-sm font-semibold">
            Examples — {normalizedField.name.trim() || "unnamed field"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fieldTypeLabel(normalizedField.type)} · values must match the field type
          </p>
        </div>

        <div className="shrink-0 border-b border-border bg-secondary/20 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Expected shape
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            type: <span className="text-foreground/90">{schemaHint.typeStr}</span>
          </p>
          <JsonLikeHighlight
            text={schemaHint.exampleStr}
            className="mt-2 rounded-md border border-border/60 bg-background/60 px-2.5 py-2 text-[11px] text-foreground/90"
          />
          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{schemaHint.entryNote}</p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <ExampleListSection
            title="Valid examples"
            hint="Sample values included in LLM prompts"
            items={normalizedField.examples}
            onChange={(examples) => onUpdate({ examples })}
            field={normalizedField}
            models={models}
            typeAliases={typeAliases}
            locked={locked}
            addLabel="Add example"
            examplePlaceholder={schemaHint.exampleStr}
            usesJsonEntry={usesJsonEntry}
            jsonSchema={jsonSchema}
          />
          <ExampleListSection
            title="Negative examples"
            hint="Values the LLM must not emit"
            items={normalizedField.negativeExamples}
            onChange={(negativeExamples) => onUpdate({ negativeExamples })}
            field={normalizedField}
            models={models}
            typeAliases={typeAliases}
            locked={locked}
            addLabel="Add counterexample"
            examplePlaceholder={schemaHint.exampleStr}
            usesJsonEntry={usesJsonEntry}
            jsonSchema={jsonSchema}
            negative
          />
        </div>

        <div className="shrink-0 border-t border-border px-4 py-3">
          <Button size="sm" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function compactExampleItems(items: string[]): string[] | undefined {
  const compact = items.filter((s) => s.length > 0)
  return compact.length ? compact : undefined
}

function exampleDisplayText(item: string): string {
  const trimmed = item.trim()
  if (!trimmed) return ""
  const parsed = tryParseJson(trimmed, { trim: true })
  return parsed.ok ? stablePrettyJsonForEdit(parsed.value) : item
}

function ExampleListSection({
  title,
  hint,
  items,
  onChange,
  field,
  models,
  typeAliases,
  locked,
  addLabel,
  examplePlaceholder,
  usesJsonEntry,
  jsonSchema,
  negative,
}: {
  title: string
  hint: string
  items?: string[]
  onChange: (items: string[] | undefined) => void
  field: ModelField
  models: StructureModel[]
  typeAliases: TypeAlias[]
  locked: boolean
  addLabel: string
  examplePlaceholder: string
  usesJsonEntry: boolean
  jsonSchema: Record<string, unknown> | null
  negative?: boolean
}) {
  const list = items ?? []
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const itemErrors = useMemo(
    () =>
      list.map((item, index) => {
        if (!item.trim()) return { ok: true as const }
        const editing = usesJsonEntry
          ? editingIndex === index
          : editingIndex === index || focusedIndex === index
        const validateDraft = negative
          ? validateNegativeFieldExampleStringDraft
          : validateFieldExampleStringDraft
        const validateFinal = negative
          ? validateNegativeFieldExampleString
          : validateFieldExampleString
        return editing
          ? validateDraft(item, field, models, typeAliases)
          : validateFinal(item, field, models, typeAliases)
      }),
    [list, field, models, typeAliases, editingIndex, focusedIndex, usesJsonEntry, negative],
  )

  function setItem(index: number, value: string) {
    const next = [...list]
    next[index] = value
    onChange(next.length ? next : undefined)
  }

  function removeItem(index: number) {
    if (editingIndex === index) setEditingIndex(null)
    onChange(compactExampleItems(list.filter((_, i) => i !== index)))
  }

  function addItem() {
    const next = [...list, ""]
    onChange(next)
    if (usesJsonEntry) setEditingIndex(next.length - 1)
  }

  function commit() {
    setEditingIndex(null)
    onChange(compactExampleItems(list))
  }

  function toggleEdit(index: number) {
    if (locked) return
    if (editingIndex === index) {
      commit()
      return
    }
    const item = list[index] ?? ""
    if (usesJsonEntry && !item.trim() && jsonSchema) {
      const root = jsonSchemaToFormRoot(jsonSchema)
      if (root) setItem(index, stablePrettyJsonForEdit(defaultFromSchema(root)))
    }
    setEditingIndex(index)
  }

  return (
    <section className="space-y-2">
      <div>
        <h3 className={cn("text-xs font-medium", negative && "text-destructive/90")}>{title}</h3>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>

      {list.length === 0 && locked ? (
        <p className="text-[11px] text-muted-foreground/50">None</p>
      ) : (
        <div className="space-y-2">
          {list.map((item, index) => {
            const validation = itemErrors[index]
            const invalid = validation && !validation.ok
            const editing = editingIndex === index
            const displayText = exampleDisplayText(item)
            const rowCount = Math.min(8, Math.max(2, item.split("\n").length))

            if (usesJsonEntry) {
              return (
                <div
                  key={index}
                  className={cn(
                    "overflow-hidden rounded-lg border bg-card shadow-sm",
                    invalid
                      ? "border-destructive/40"
                      : negative
                        ? "border-destructive/20"
                        : "border-border",
                  )}
                >
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                      {index + 1}.
                    </span>
                    {invalid ? (
                      <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    ) : item.trim() ? (
                      <CircleCheck className="h-3.5 w-3.5 shrink-0 text-chart-2" />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
                      {item.trim() ? displayText.replace(/\s+/g, " ").slice(0, 80) : "Empty — click edit to add"}
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      {!locked && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn("h-7 w-7", editing ? "text-primary" : "text-muted-foreground")}
                          title={editing ? "Done editing" : "Edit example"}
                          onClick={() => toggleEdit(index)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                          aria-label="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {editing ? (
                    <div className="p-3">
                      {jsonSchema ? (
                        <SchemaJsonEditor
                          schema={jsonSchema}
                          text={displayText || item}
                          onText={(value) => setItem(index, value)}
                        />
                      ) : (
                        <p className="font-mono text-[10px] text-destructive">
                          Complete the field type before adding examples.
                        </p>
                      )}
                    </div>
                  ) : item.trim() ? (
                    <div className="max-h-40 overflow-auto p-3">
                      <JsonLikeHighlight
                        text={displayText}
                        className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 text-[11px] text-foreground/90"
                      />
                    </div>
                  ) : null}

                  {invalid && (
                    <p className="border-t border-border px-3 py-2 font-mono text-[10px] leading-snug text-destructive">
                      {validation.error}
                    </p>
                  )}
                </div>
              )
            }

            return (
              <div key={index} className="space-y-1">
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                    {index + 1}.
                  </span>
                  <div
                    className={cn(
                      "relative min-w-0 flex-1 overflow-hidden rounded-md border bg-secondary/20",
                      invalid
                        ? "border-destructive/60 focus-within:border-destructive focus-within:ring-2 focus-within:ring-destructive/20"
                        : negative
                          ? "border-destructive/20 focus-within:border-destructive/40 focus-within:ring-2 focus-within:ring-destructive/10"
                          : "border-border focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
                    )}
                  >
                    <textarea
                      value={item}
                      onChange={(e) => {
                        setEditingIndex(index)
                        setItem(index, e.target.value)
                      }}
                      onFocus={() => {
                        setFocusedIndex(index)
                        setEditingIndex(index)
                      }}
                      onBlur={() => {
                        setFocusedIndex((prev) => (prev === index ? null : prev))
                        commit()
                      }}
                      readOnly={locked}
                      placeholder={examplePlaceholder}
                      rows={rowCount}
                      aria-invalid={invalid || undefined}
                      spellCheck={false}
                      className={cn(
                        "min-h-[4.5rem] w-full resize-y bg-transparent px-2.5 py-2 font-mono text-xs leading-relaxed outline-none placeholder:text-muted-foreground/50 read-only:cursor-not-allowed",
                        invalid && "text-destructive",
                        locked && "opacity-80",
                      )}
                    />
                  </div>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="mt-1.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {invalid && (
                  <p className="pl-7 font-mono text-[10px] leading-snug text-destructive">
                    {validation.error}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!locked && (
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addItem}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {addLabel}
        </Button>
      )}
    </section>
  )
}
