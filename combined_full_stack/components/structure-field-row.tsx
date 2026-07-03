"use client"

import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { StructureFieldTypeEditor } from "@/components/structure-field-type-editor"
import { JSON_FIELD_PREFER_STRUCTURE_MSG, type ModelField, type StructureModel } from "@/lib/types"
import { cn } from "@/lib/utils"

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
  fields: Pick<ModelField, "ref" | "name">[]
  models: StructureModel[]
  selectedId: string
  locked: boolean
  onUpdate: (patch: Partial<ModelField>) => void
  onRemove: () => void
}) {
  const isLegacyJson = field.type === "json" && !field.typeExpr

  return (
    <div>
      <div className="grid grid-cols-[1.1fr_1fr_1.2fr_1fr_auto] items-start gap-2 border-b border-border px-3 py-2">
        <Input
          value={field.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          readOnly={locked}
          className="h-8 font-mono text-xs"
        />
        <StructureFieldTypeEditor
          field={field}
          fields={fields}
          models={models}
          selectedId={selectedId}
          locked={locked}
          onUpdate={onUpdate}
        />
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
        <div className="flex h-8 w-20 items-center justify-center gap-1">
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
          {/* AI : deterministic flag (spec § Testing) — "=" exact-compared in tests, "≈" probabilistic (ignored) */}
          <button
            onClick={() => onUpdate({ deterministic: field.deterministic === false ? undefined : false })}
            disabled={locked}
            title={
              field.deterministic === false
                ? "probabilistic — value varies between runs (LLM prose); tests ignore this field"
                : "deterministic — same input always gives this value (maths answer, id, enum); tests exact-compare it"
            }
            className={cn(
              "h-5 w-5 rounded border text-[10px] font-medium",
              field.deterministic === false
                ? "border-chart-3 bg-chart-3/15 text-chart-3"
                : "border-border text-muted-foreground",
            )}
          >
            {field.deterministic === false ? "≈" : "="}
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
      {isLegacyJson && (
        <div className="border-b border-border bg-amber-500/5 px-3 py-1.5">
          <p className={cn("font-mono text-[10px] text-amber-700 dark:text-amber-500")}>
            {JSON_FIELD_PREFER_STRUCTURE_MSG}
          </p>
        </div>
      )}
    </div>
  )
}
