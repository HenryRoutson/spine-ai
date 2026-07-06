"use client"

import { MODULE_META, type PipelineModule, type StructureModel, type TypeAlias } from "@/lib/types"
import { isAutoQuoteStep } from "@/lib/quote-steps"
import { isAutoStructureParseStep } from "@/lib/structure-parse-steps"
import { AutoQuoteLock, AutoStructureParseLock } from "@/lib/module-ui"
import { PipelineModuleFields } from "@/components/pipeline-module-fields"

type PipelineInspectorProps = {
  module: PipelineModule | undefined
  models: StructureModel[]
  typeAliases?: TypeAlias[]
  modules?: PipelineModule[]
}

// AI : read-only mirror of the Pipeline tab inspector — prompts, I/O, code, schema.
export function PipelineInspector({ module: selected, models, typeAliases = [], modules = [] }: PipelineInspectorProps) {
  if (!selected) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center p-6 text-center">
        <p className="text-xs text-muted-foreground">Select a step to view its config.</p>
      </div>
    )
  }

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {MODULE_META[selected.kind].label}
        </span>
        {isAutoQuoteStep(selected) && <AutoQuoteLock />}
        {isAutoStructureParseStep(selected) && <AutoStructureParseLock />}
      </div>
      <PipelineModuleFields
        module={selected}
        models={models}
        typeAliases={typeAliases}
        modules={modules}
        mode="view"
      />
    </div>
  )
}
