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
import { formatIfCondition } from "@/lib/if-else-pipeline"
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

export function IfElseModuleFields({ selected, edit, onUpdate }: IfElseModuleFieldsProps) {
  const cond = selected.ifCondition
  const kind = cond?.kind === IfConditionKind.Equals ? IfConditionKind.Equals : IfConditionKind.Path
  const path = cond?.path ?? ""
  const valueText =
    cond?.kind === IfConditionKind.Equals ? JSON.stringify(cond.value) : ""

  function setCondition(next: IfCondition) {
    onUpdate?.({ ifCondition: next })
  }

  return (
    <>
      <PipelineField
        label="Condition"
        hint="Typed path on the previous spine. Path must be bool, or use equals to compare a field to a JSON value."
      >
        {edit ? (
          <div className="flex flex-col gap-2">
            <Select
              value={kind}
              onValueChange={(v) => {
                if (v === IfConditionKind.Equals) {
                  setCondition({ kind: IfConditionKind.Equals, path, value: cond?.kind === IfConditionKind.Equals ? cond.value : true })
                } else {
                  setCondition({ kind: IfConditionKind.Path, path })
                }
              }}
            >
              <SelectTrigger className="h-8 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={IfConditionKind.Path}>bool path</SelectItem>
                <SelectItem value={IfConditionKind.Equals}>field equals</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={path}
              onChange={(e) =>
                setCondition(
                  kind === IfConditionKind.Equals
                    ? { kind: IfConditionKind.Equals, path: e.target.value, value: cond?.kind === IfConditionKind.Equals ? cond.value : true }
                    : { kind: IfConditionKind.Path, path: e.target.value },
                )
              }
              className="h-8 font-mono text-xs"
              placeholder="is_legal"
            />
            {kind === IfConditionKind.Equals && (
              <Input
                value={valueText}
                onChange={(e) =>
                  setCondition({ kind: IfConditionKind.Equals, path, value: parseEqualsValue(e.target.value) })
                }
                className="h-8 font-mono text-xs"
                placeholder='"legal" or true'
              />
            )}
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
