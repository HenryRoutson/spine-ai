"use client"

import { Textarea } from "@/components/ui/textarea"
import { InvalidKind, type InvalidStep } from "@/lib/validity"
import type { PipelineModule } from "@/lib/types"
import { PipelineField, StaticValue } from "@/components/pipeline-fields/shared"

type SqlModuleFieldsProps = {
  selected: PipelineModule
  edit: boolean
  invalid?: InvalidStep
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

export function SqlModuleFields({ selected, edit, invalid, onUpdate }: SqlModuleFieldsProps) {
  const missing = invalid?.kind === InvalidKind.MissingSql

  return (
    <>
      <PipelineField
        label="SQL"
        hint="Hosted-app SQL: SELECT / UPDATE / INSERT on tables from your structures. Leave empty for SELECT * from the output structure, or empty after an extract of that structure to INSERT."
        hintTone={missing ? "error" : undefined}
      >
        {edit ? (
          <Textarea
            value={selected.sql ?? ""}
            onChange={(e) => onUpdate!({ sql: e.target.value || undefined })}
            onBlur={(e) => {
              const trimmed = e.target.value.trim()
              if (trimmed !== (selected.sql ?? "")) onUpdate!({ sql: trimmed || undefined })
            }}
            placeholder="Leave empty to derive SELECT * or INSERT from the output structure"
            className="min-h-24 font-mono text-xs"
          />
        ) : selected.sql?.trim() ? (
          <StaticValue mono>{selected.sql}</StaticValue>
        ) : null}
      </PipelineField>
    </>
  )
}
