"use client"

import { Lock } from "lucide-react"
import { MODULE_META, type PipelineModule, type StructureModel } from "@/lib/types"
import { isAutoQuoteStep } from "@/lib/quote-steps"
import { PipelineModuleFields } from "@/components/pipeline-module-fields"

type PipelineInspectorProps = {
  module: PipelineModule | undefined
  models: StructureModel[]
  modules?: PipelineModule[]
}

// AI : read-only mirror of the Pipeline tab inspector — prompts, I/O, code, schema.
export function PipelineInspector({ module: selected, models, modules = [] }: PipelineInspectorProps) {
  if (!selected) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center p-6 text-center">
        <p className="text-xs text-muted-foreground">Select a step to view its config.</p>
      </div>
    )
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {MODULE_META[selected.kind].label}
        </span>
        {isAutoQuoteStep(selected) && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-chart-2/40 bg-chart-2/10 px-1.5 py-0.5 text-chart-2">
            <Lock className="h-3 w-3" />
            <span className="font-mono text-[9px]">auto</span>
          </span>
        )}
      </div>
      <PipelineModuleFields module={selected} models={models} modules={modules} mode="view" />
    </div>
  )
}
