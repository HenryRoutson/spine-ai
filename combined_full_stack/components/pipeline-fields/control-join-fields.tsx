"use client"

import { PipelineField } from "@/components/pipeline-fields/shared"

export function ControlJoinModuleFields() {
  return (
    <PipelineField
      label="Join"
      hint="Optional. Continues the spine with the taken if/case arm. Delete this step to keep exclusive sinks — later spine steps will not run."
    >
      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
        Only the taken branch executes. Logging marks other arms skipped.
      </p>
    </PipelineField>
  )
}
