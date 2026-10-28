"use client"
// AI : PK / FK row-id authoring — nested records stay StructureFieldRefPicker.

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  fieldRelationLabel,
  fieldSqlIdType,
  pkFieldOf,
  suggestFieldRelation,
} from "@/lib/sql-id-types"
import type { FieldRelation, ModelField, StructureModel, StructureModelId } from "@/lib/types"
import { cn } from "@/lib/utils"

function keyValue(field: ModelField): string {
  const rel = field.relation
  if (rel?.kind === "pk") return "pk"
  if (rel?.kind === "fk") return `fk:${rel.to.modelId}:${rel.to.field}`
  return "none"
}

export function StructureFieldKeyPicker({
  field,
  host,
  models,
  locked,
  onChange,
}: {
  field: ModelField
  host: StructureModel
  models: StructureModel[]
  locked: boolean
  onChange: (relation: FieldRelation | undefined) => void
}) {
  const suggestion = suggestFieldRelation(field, host, models)
  const branded = fieldSqlIdType(host, field, models)
  const pkTargets = models
    .map((m) => {
      const pk = pkFieldOf(m)
      return pk ? { model: m, pk } : undefined
    })
    .filter((x): x is { model: StructureModel; pk: ModelField } => !!x)

  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-1 py-1">
      <Select
        value={keyValue(field)}
        onValueChange={(v) => {
          if (!v || v === "none") onChange(undefined)
          else if (v === "pk") onChange({ kind: "pk" })
          else if (v.startsWith("fk:")) {
            const [, modelId, fieldName] = v.split(":")
            if (modelId && fieldName) {
              onChange({ kind: "fk", to: { modelId: modelId as StructureModelId, field: fieldName } })
            }
          }
        }}
        disabled={locked}
      >
        <SelectTrigger
          className="h-6 w-full font-mono text-[10px]"
          data-spine-id="structure.set-relation"
        >
          <span className="truncate">{fieldRelationLabel(field, models)}</span>
        </SelectTrigger>
        <SelectContent className="min-w-[12rem]">
          <SelectItem value="none" className="font-mono text-xs">
            —
          </SelectItem>
          <SelectItem value="pk" className="font-mono text-xs">
            PK
          </SelectItem>
          {pkTargets.length > 0 && (
            <SelectGroup>
              <SelectLabel className="font-mono text-[10px] uppercase tracking-wider">
                Foreign key
              </SelectLabel>
              {pkTargets.map(({ model, pk }) => (
                <SelectItem
                  key={`${model.id}:${pk.name}`}
                  value={`fk:${model.id}:${pk.name}`}
                  className="font-mono text-xs"
                >
                  FK → {model.name}.{pk.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      {branded && (
        <span className="truncate font-mono text-[9px] text-muted-foreground">{branded}</span>
      )}
      {suggestion && !locked && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-5 justify-start px-1 font-mono text-[9px] text-muted-foreground"
          onClick={() => onChange(suggestion)}
        >
          suggest {suggestion.kind === "pk" ? "PK" : fieldRelationLabel({ ...field, relation: suggestion }, models)}
        </Button>
      )}
    </div>
  )
}
