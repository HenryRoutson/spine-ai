"use client"

import { Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select"
import { useAppShell } from "@/lib/app-shell"
import {
  groupModelsForRefPicker,
  modelRefLabel,
  refPickerLabel,
} from "@/lib/structure-ref"
import { FieldType, type ModelField, type StructureModel, type StructureModelId } from "@/lib/types"
import { cn } from "@/lib/utils"

const REF_TYPES: FieldType[] = [FieldType.Model, FieldType.ListModel]

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
  const { openStructure } = useAppShell()

  if (!isRefFieldType(field.type)) return null

  const groups = groupModelsForRefPicker(models, selectedId, fields)
  const refLabel = modelRefLabel(
    models,
    field.ref,
    fields.filter((f) => f.ref === field.ref).map((f) => f.name),
  )
  const hasOptions =
    groups.roots.length + groups.nested.length + (groups.self ? 1 : 0) + groups.missing.length > 0

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span
        className={cn(
          "shrink-0 font-mono text-muted-foreground",
          compact ? "text-[9px]" : "text-[10px]",
        )}
      >
        {refPickerLabel(field.type)}
      </span>
        <Select
        value={field.ref ?? ""}
        onValueChange={(v) => onRefChange(v ? (v as StructureModelId) : undefined)}
        disabled={locked || !hasOptions}
      >
        <SelectTrigger
          className={cn(
            "min-w-0 flex-1 font-mono",
            compact ? "h-6 w-full text-[10px]" : "h-7 w-full text-[11px]",
          )}
        >
          <span className="truncate">{refLabel}</span>
        </SelectTrigger>
        <SelectContent className="min-w-[12rem]">
          {groups.roots.length > 0 && (
            <SelectGroup>
              <SelectLabel className="font-mono text-[10px] uppercase tracking-wider">
                Root models
              </SelectLabel>
              {groups.roots.map((m) => (
                <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                  {m.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {groups.nested.length > 0 && (
            <SelectGroup>
              <SelectLabel className="font-mono text-[10px] uppercase tracking-wider">
                Sub-types
              </SelectLabel>
              {groups.nested.map((m) => (
                <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                  {m.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {groups.self && (
            <SelectGroup>
              <SelectLabel className="font-mono text-[10px] uppercase tracking-wider">
                This model
              </SelectLabel>
              <SelectItem key={groups.self.id} value={groups.self.id} className="font-mono text-xs">
                {groups.self.name} (recursive)
              </SelectItem>
            </SelectGroup>
          )}
          {groups.missing.length > 0 && (
            <SelectGroup>
              <SelectLabel className="font-mono text-[10px] uppercase tracking-wider">
                Missing
              </SelectLabel>
              {groups.missing.map((m) => (
                <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                  {m.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn("shrink-0 text-muted-foreground", compact ? "h-6 w-6" : "h-7 w-7")}
        disabled={!field.ref || locked}
        onClick={() => field.ref && openStructure(field.ref)}
        title={field.ref ? `Open ${refLabel} in Structure tab` : "Pick a model to open"}
      >
        <Link2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </Button>
    </div>
  )
}
