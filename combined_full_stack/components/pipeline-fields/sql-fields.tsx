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
        hint="Hosted-app SQL: SELECT / UPDATE / INSERT / DELETE on tables from your structures (Todo → todo). AND is allowed in WHERE. No JOIN."
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
            placeholder="UPDATE todo SET done = true WHERE id = 't1' RETURNING *"
            className="min-h-24 font-mono text-xs"
          />
        ) : selected.sql?.trim() ? (
          <StaticValue mono>{selected.sql}</StaticValue>
        ) : null}
      </PipelineField>
      <PipelineField label="Seed rows" hint="JSON array inserted when the table is empty. Example: [{&quot;id&quot;:&quot;t1&quot;,&quot;title&quot;:&quot;Buy milk&quot;}]">
        {edit ? (
          <Textarea
            value={selected.sqlSeedRows ? JSON.stringify(selected.sqlSeedRows, null, 2) : ""}
            onChange={(e) => {
              const raw = e.target.value.trim()
              if (!raw) {
                onUpdate!({ sqlSeedRows: undefined })
                return
              }
              try {
                const parsed = JSON.parse(raw) as unknown
                if (Array.isArray(parsed)) onUpdate!({ sqlSeedRows: parsed as Record<string, unknown>[] })
              } catch {
                // AI : wait for valid JSON
              }
            }}
            placeholder='[{ "id": "t1", "title": "Buy milk" }]'
            className="min-h-16 font-mono text-xs"
          />
        ) : selected.sqlSeedRows?.length ? (
          <StaticValue mono>{JSON.stringify(selected.sqlSeedRows)}</StaticValue>
        ) : null}
      </PipelineField>
    </>
  )
}
