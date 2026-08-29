"use client"

import { Input } from "@/components/ui/input"
import { PipelineField, StaticValue } from "@/components/pipeline-fields/shared"
import { forkBranchesOf } from "@/lib/fork-pipeline"
import { isDefaultCaseMatch } from "@/lib/case-pipeline"
import { IfConditionKind, type PipelineModule } from "@/lib/types"

type CaseModuleFieldsProps = {
  selected: PipelineModule
  edit: boolean
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

export function CaseModuleFields({ selected, edit, onUpdate }: CaseModuleFieldsProps) {
  const path = selected.ifCondition?.path ?? ""
  const branches = forkBranchesOf(selected)

  return (
    <>
      <PipelineField
        label="Match field"
        hint="Scalar on the previous spine. Compute categories in custom-code, then switch here. Add a Join after this box to continue the spine."
      >
        {edit ? (
          <Input
            value={path}
            onChange={(e) => onUpdate?.({ ifCondition: { kind: IfConditionKind.Path, path: e.target.value } })}
            className="h-8 font-mono text-xs"
            placeholder="status"
          />
        ) : (
          <StaticValue mono>{path || "set match path"}</StaticValue>
        )}
      </PipelineField>
      <PipelineField label="Arms" hint="Exact match on the field. Empty, _, *, or default is the fallback arm.">
        {edit ? (
          <div className="space-y-1.5">
            {branches.map((b, i) => (
              <div key={b.id} className="flex items-center gap-2">
                <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">{b.label}</span>
                <Input
                  value={b.match ?? ""}
                  onChange={(e) => {
                    const next = branches.map((arm, j) => (j === i ? { ...arm, match: e.target.value } : arm))
                    onUpdate?.({ forkBranches: next })
                  }}
                  className="h-8 font-mono text-xs"
                  placeholder={i === branches.length - 1 ? "_" : "value"}
                />
              </div>
            ))}
          </div>
        ) : (
          <StaticValue mono>
            {branches.map((b) => `${b.label}=${isDefaultCaseMatch(b.match) ? "default" : b.match}`).join(" · ")}
          </StaticValue>
        )}
      </PipelineField>
    </>
  )
}
