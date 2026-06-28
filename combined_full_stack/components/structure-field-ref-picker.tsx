"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { modelRefLabel, modelsForRefPicker, refPickerLabel } from "@/lib/structure-ref"
import type { FieldType, ModelField, StructureModel, StructureModelId } from "@/lib/types"
import { cn } from "@/lib/utils"

const REF_TYPES: FieldType[] = ["model", "list[model]"]

export function isRefFieldType(type: FieldType): boolean {
  return REF_TYPES.includes(type)
}

export function StructureFieldRefPicker({
  field,
  fields,
  models,
  selectedId,
  locked,
  onRefChange,
  className,
  compact,
}: {
  field: ModelField
  fields: Pick<ModelField, "ref" | "name">[]
  models: StructureModel[]
  selectedId: string
  locked: boolean
  onRefChange: (ref: StructureModelId | undefined) => void
  className?: string
  compact?: boolean
}) {
  if (!isRefFieldType(field.type)) return null

  const refModels = modelsForRefPicker(models, selectedId, fields)
  const refLabel = modelRefLabel(
    models,
    field.ref,
    fields.filter((f) => f.ref === field.ref).map((f) => f.name),
  )

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <span
        className={cn(
          "shrink-0 font-mono text-muted-foreground",
          compact ? "text-[9px]" : "text-[10px]",
        )}
      >
        {refPickerLabel(field.type)}
      </span>
      <Select
        value={field.ref}
        onValueChange={(v) => onRefChange(v || undefined)}
        disabled={locked}
      >
        <SelectTrigger
          className={cn(
            "min-w-0 flex-1 font-mono",
            compact ? "h-6 text-[10px]" : "h-7 text-[11px]",
          )}
        >
          <span className="truncate">{refLabel}</span>
        </SelectTrigger>
        <SelectContent>
          {refModels.map((m) => (
            <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
