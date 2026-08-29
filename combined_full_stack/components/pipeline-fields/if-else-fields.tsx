"use client"

import { Input } from "@/components/ui/input"
import { PipelineField, StaticValue } from "@/components/pipeline-fields/shared"
import { formatIfCondition } from "@/lib/if-condition"
import { IfConditionKind, type PipelineModule } from "@/lib/types"

type IfElseModuleFieldsProps = {
  selected: PipelineModule
  edit: boolean
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

export function IfElseModuleFields({ selected, edit, onUpdate }: IfElseModuleFieldsProps) {
  const path = selected.ifCondition?.path ?? ""

  return (
    <>
      <PipelineField
        label="Condition"
        hint="Bool field on the previous spine. Compute gt/equals/contains in custom-code or Python, then branch here. For/while stays in code — the graph is acyclic."
      >
        {edit ? (
          <Input
            value={path}
            onChange={(e) => onUpdate?.({ ifCondition: { kind: IfConditionKind.Path, path: e.target.value } })}
            className="h-8 font-mono text-xs"
            placeholder="is_legal"
          />
        ) : (
          <StaticValue mono>{formatIfCondition(selected.ifCondition)}</StaticValue>
        )}
      </PipelineField>
      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
        Then runs when the field is true. Else is optional — empty means passthrough of the previous spine.
        Then and Else may emit different types; add a Join after this box to continue the spine as their union.
        Without Join, only the taken arm runs.
      </p>
    </>
  )
}
