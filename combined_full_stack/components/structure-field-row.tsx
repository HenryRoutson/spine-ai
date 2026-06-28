"use client"

import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StructureFieldRefPicker, isRefFieldType } from "@/components/structure-field-ref-picker"
import { JSON_FIELD_PREFER_STRUCTURE_MSG, FIELD_TYPES, type FieldType, type ModelField, type StructureModel } from "@/lib/types"
import { cn } from "@/lib/utils"

const REF_TYPES: FieldType[] = ["model", "list[model]"]

export function StructureFieldRow({
  field,
  fields,
  models,
  selectedId,
  locked,
  onUpdate,
  onRemove,
}: {
  field: ModelField
  fields: ModelField[]
  models: StructureModel[]
  selectedId: string
  locked: boolean
  onUpdate: (patch: Partial<ModelField>) => void
  onRemove: () => void
}) {
  return (
    <div>
      <div className="grid grid-cols-[1.1fr_1fr_1.2fr_1fr_auto] items-center gap-2 border-b border-border px-3 py-2">
        <Input
          value={field.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          readOnly={locked}
          className="h-8 font-mono text-xs"
        />
        <div className="min-w-0 space-y-1">
          <Select
            value={field.type}
            onValueChange={(v) =>
              onUpdate({
                type: v as FieldType,
                ref: REF_TYPES.includes(v as FieldType)
                  ? models.find((m) => m.id !== selectedId)?.id
                  : undefined,
              })
            }
            disabled={locked}
          >
            <SelectTrigger className="h-8 font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="font-mono text-xs">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isRefFieldType(field.type) && (
            <StructureFieldRefPicker
              field={field}
              fields={fields}
              models={models}
              selectedId={selectedId}
              locked={locked}
              onRefChange={(ref) => onUpdate({ ref })}
              compact
            />
          )}
        </div>
        <Input
          value={field.description}
          placeholder="—"
          onChange={(e) => onUpdate({ description: e.target.value })}
          readOnly={locked}
          className="h-8 text-xs"
        />
        <Input
          value={field.example ?? ""}
          placeholder="e.g. Acme Ltd"
          onChange={(e) => onUpdate({ example: e.target.value || undefined })}
          readOnly={locked}
          className="h-8 font-mono text-xs"
        />
        <div className="flex w-14 items-center justify-center gap-1">
          <button
            onClick={() => onUpdate({ optional: !field.optional })}
            disabled={locked}
            className={cn(
              "h-5 w-5 rounded border text-[10px] font-medium",
              field.optional
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {field.optional ? "?" : "·"}
          </button>
          <button
            onClick={onRemove}
            disabled={locked}
            className="text-muted-foreground hover:text-destructive disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {field.type === "json" && (
        <div className="border-b border-border bg-amber-500/5 px-3 py-1.5">
          <p className="font-mono text-[10px] text-amber-700 dark:text-amber-500">
            {JSON_FIELD_PREFER_STRUCTURE_MSG}
          </p>
        </div>
      )}
    </div>
  )
}
