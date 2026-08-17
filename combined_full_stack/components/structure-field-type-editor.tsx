"use client"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StructureFieldRefPicker } from "@/components/structure-field-ref-picker"
import { FIELD_TYPES, FieldType, type ModelField, type StructureModel } from "@/lib/types"
import { fieldTypeLabel } from "@/lib/structure-field-labels"
import { pickDefaultModelRef } from "@/lib/structure-ref"
import { legacyFieldFromTypeExpr, formatTypeExprPy } from "@/lib/type-expr-parse"
import { fieldToTypeExpr, typeExprEqual, typeExprRefModelId } from "@/lib/server/type_expr"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const REF_TYPES: FieldType[] = [FieldType.Model, FieldType.ListModel]
const PRESET_TYPES = FIELD_TYPES.filter((t) => !REF_TYPES.includes(t))
const ALIAS_PREFIX = "alias:"

function isRefField(field: ModelField): boolean {
  if (REF_TYPES.includes(field.type) && !field.typeExpr) return true
  return typeExprRefModelId(fieldToTypeExpr(field)) !== undefined
}

function refFieldType(field: ModelField): FieldType {
  const expr = fieldToTypeExpr(field)
  if (expr.kind === "list" && expr.item.kind === "ref") return FieldType.ListModel
  if (expr.kind === "optional" && expr.inner.kind === "list" && expr.inner.item.kind === "ref") {
    return FieldType.ListModel
  }
  if (expr.kind === "ref") return FieldType.Model
  return field.type === FieldType.ListModel ? FieldType.ListModel : FieldType.Model
}

function refFieldForPicker(field: ModelField): ModelField {
  const refId = typeExprRefModelId(fieldToTypeExpr(field))
  if (!refId) return field
  const asList = refFieldType(field) === FieldType.ListModel
  return { ...field, type: asList ? FieldType.ListModel : FieldType.Model, ref: refId, typeExpr: undefined }
}

function resolveSelectValueWithAliases(
  field: ModelField,
  models: StructureModel[],
  typeAliases: { id: string; name: string; expr: import("@/lib/server/type_expr").TypeExpr }[],
): { value: string; orphanLabel?: string } {
  const expr = field.typeExpr
  if (expr) {
    if (expr.kind === "named") {
      const alias = typeAliases.find((t) => t.name === expr.name)
      if (alias) return { value: `${ALIAS_PREFIX}${alias.id}` }
      return { value: "__orphan__", orphanLabel: expr.name }
    }
    const legacy = legacyFieldFromTypeExpr(expr)
    if (legacy?.type === "model" || legacy?.type === "list[model]") return { value: legacy.type }
    if (legacy && PRESET_TYPES.includes(legacy.type)) return { value: legacy.type }

    const matched = typeAliases.find((t) => typeExprEqual(t.expr, expr))
    if (matched) return { value: `${ALIAS_PREFIX}${matched.id}` }
    return { value: "__orphan__", orphanLabel: formatTypeExprPy(expr, models) }
  }

  if (field.type === "model" || field.type === "list[model]") return { value: field.type }
  if (PRESET_TYPES.includes(field.type)) return { value: field.type }
  return { value: field.type }
}

function resolveSelectDisplayLabel(
  selectValue: string,
  typeAliases: { id: string; name: string }[],
  orphanLabel?: string,
): string {
  if (selectValue.startsWith(ALIAS_PREFIX)) {
    const alias = typeAliases.find((t) => t.id === selectValue.slice(ALIAS_PREFIX.length))
    return alias?.name ?? selectValue
  }
  if (selectValue === "__orphan__") {
    return orphanLabel ? `${orphanLabel} (pick a type)` : "Unknown type"
  }
  if (selectValue === FieldType.Model) return "Nested record…"
  if (selectValue === FieldType.ListModel) return "List of records…"
  if (PRESET_TYPES.includes(selectValue as FieldType)) return fieldTypeLabel(selectValue as FieldType)
  return selectValue
}

export function StructureFieldTypeEditor({
  field,
  fields,
  models,
  selectedId,
  locked,
  onUpdate,
}: {
  field: ModelField
  fields: Pick<ModelField, "ref" | "name">[]
  models: StructureModel[]
  selectedId: string
  locked: boolean
  onUpdate: (patch: Partial<ModelField>) => void
}) {
  const { typeAliases } = useStore()
  const { value: selectValue, orphanLabel } = resolveSelectValueWithAliases(field, models, typeAliases)
  const selectDisplayLabel = resolveSelectDisplayLabel(selectValue, typeAliases, orphanLabel)
  const showRefPicker = isRefField(field)

  function selectType(next: string | null) {
    if (!next || next === "__orphan__") return

    if (next.startsWith(ALIAS_PREFIX)) {
      const aliasId = next.slice(ALIAS_PREFIX.length)
      const alias = typeAliases.find((t) => t.id === aliasId)
      if (!alias) return
      // AI : TODO (generics) — parametric alias → Generic name+UNSET args, not a bare Named.
      onUpdate({
        type: FieldType.Json,
        typeExpr: { kind: "named", name: alias.name },
        ref: undefined,
      })
      return
    }

    if (next === FieldType.Model || next === FieldType.ListModel) {
      onUpdate({
        type: next as FieldType,
        typeExpr: undefined,
        ref: pickDefaultModelRef(models, selectedId),
      })
      return
    }

    onUpdate({
      type: next as FieldType,
      typeExpr: undefined,
      ref: undefined,
    })
  }

  return (
    <div className="min-w-0 space-y-1">
      <Select value={selectValue} onValueChange={selectType} disabled={locked}>
        <SelectTrigger className="h-8 font-mono text-xs">
          <SelectValue placeholder="Pick type…">{selectDisplayLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="font-mono text-[10px] uppercase tracking-wider">
              Scalars
            </SelectLabel>
            {PRESET_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="font-mono text-xs">
                {fieldTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="font-mono text-[10px] uppercase tracking-wider">
              Structs
            </SelectLabel>
            <SelectItem value="model" className="font-mono text-xs">
              Nested record…
            </SelectItem>
            <SelectItem value="list[model]" className="font-mono text-xs">
              List of records…
            </SelectItem>
          </SelectGroup>
          {typeAliases.length > 0 && (
            <SelectGroup>
              <SelectLabel className="font-mono text-[10px] uppercase tracking-wider">
                Types
              </SelectLabel>
              {typeAliases.map((t) => (
                <SelectItem key={t.id} value={`${ALIAS_PREFIX}${t.id}`} className="font-mono text-xs">
                  {t.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {orphanLabel && (
            <SelectGroup>
              <SelectItem value="__orphan__" disabled className="font-mono text-xs text-muted-foreground">
                {orphanLabel} (pick a type)
              </SelectItem>
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {showRefPicker && (
        <StructureFieldRefPicker
          field={refFieldForPicker(field)}
          fields={fields}
          models={models}
          selectedId={selectedId}
          locked={locked}
          compact
          onRefChange={(ref) =>
            onUpdate({
              type: refFieldType(field),
              ref,
              typeExpr: undefined,
            })
          }
        />
      )}

      {typeAliases.length === 0 && (
        <p className="font-mono text-[9px] text-muted-foreground">
          Add reusable types in the sidebar → Types
        </p>
      )}

      {orphanLabel && (
        <p className={cn("font-mono text-[9px] text-amber-700 dark:text-amber-500")}>
          Unknown type — recreate it under Types or pick another
        </p>
      )}
    </div>
  )
}
