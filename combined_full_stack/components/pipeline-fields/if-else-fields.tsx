"use client"

import { Input } from "@/components/ui/input"
import { PipelineField, StaticValue } from "@/components/pipeline-fields/shared"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  IF_CONDITION_KINDS,
  IF_CONDITION_KIND_META,
  formatIfCondition,
  ifConditionNeedsValue,
  parseIfCondition,
} from "@/lib/if-condition"
import { IfConditionKind, type IfCondition, type PipelineModule } from "@/lib/types"

type IfElseModuleFieldsProps = {
  selected: PipelineModule
  edit: boolean
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

function parseEqualsValue(raw: string): unknown {
  const t = raw.trim()
  if (!t) return ""
  try {
    return JSON.parse(t) as unknown
  } catch {
    return t
  }
}

function valueText(cond: IfCondition | undefined): string {
  if (!cond || !("value" in cond)) return ""
  try {
    return JSON.stringify(cond.value)
  } catch {
    return String(cond.value)
  }
}

export function IfElseModuleFields({ selected, edit, onUpdate }: IfElseModuleFieldsProps) {
  const cond = selected.ifCondition
  const kind = cond?.kind ?? IfConditionKind.Path
  const path = cond?.path ?? ""

  function setCondition(next: IfCondition) {
    onUpdate?.({ ifCondition: next })
  }

  return (
    <>
      <PipelineField
        label="Condition"
        hint="Typed predicate on the previous spine. Kind is validated against the field type (bool, number, list, optional, …). For/while loops stay in custom-code or llm-batch — the graph is acyclic."
      >
        {edit ? (
          <div className="flex flex-col gap-2">
            <Select
              value={kind}
              onValueChange={(v) => {
                if (!v) return
                const nextKind = (IF_CONDITION_KINDS as readonly string[]).includes(v) ? (v as IfConditionKind) : IfConditionKind.Path
                setCondition(parseIfCondition(nextKind, path, cond && "value" in cond ? cond.value : undefined))
              }}
            >
              <SelectTrigger className="h-8 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IF_CONDITION_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {IF_CONDITION_KIND_META[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={path}
              onChange={(e) => setCondition(parseIfCondition(kind, e.target.value, cond && "value" in cond ? cond.value : undefined))}
              className="h-8 font-mono text-xs"
              placeholder="is_legal"
            />
            {ifConditionNeedsValue(kind) && (
              <Input
                value={valueText(cond)}
                onChange={(e) => setCondition(parseIfCondition(kind, path, parseEqualsValue(e.target.value)))}
                className="h-8 font-mono text-xs"
                placeholder={kind === IfConditionKind.In ? '["legal","billing"]' : '"legal" or 3'}
              />
            )}
            <p className="font-mono text-[10px] text-muted-foreground">{IF_CONDITION_KIND_META[kind].hint}</p>
          </div>
        ) : (
          <StaticValue mono>{formatIfCondition(cond)}</StaticValue>
        )}
      </PipelineField>
      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
        Then runs when the condition is true. Else is optional — empty means passthrough of the previous spine.
      </p>
    </>
  )
}
