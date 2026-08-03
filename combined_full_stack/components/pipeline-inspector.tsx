"use client"

import { MODULE_META, type PipelineModule, type StructureModel, type TypeAlias } from "@/lib/types"
import { isAutoQuoteStep } from "@/lib/quote-steps"
import { isAutoStructureParseStep } from "@/lib/structure-parse-steps"
import { AutoQuoteLock, AutoStructureParseLock } from "@/lib/module-ui"
import { PipelineModuleFields } from "@/components/pipeline-module-fields"
import { InspectorCollapsibleSection } from "@/components/inspector-collapsible-section"
import { INSPECTOR_SECTION_BORDER_CLASS, INSPECTOR_SECTION_TITLE_CLASS } from "@/lib/ui-classes"
import { cn } from "@/lib/utils"

type PipelineInspectorProps = {
  module: PipelineModule | undefined
  models: StructureModel[]
  typeAliases?: TypeAlias[]
  modules?: PipelineModule[]
}

// AI : read-only mirror of the Pipeline tab inspector — prompts, I/O, code, schema.
export function PipelineInspector({ module: selected, models, typeAliases = [], modules = [] }: PipelineInspectorProps) {
  return (
    <InspectorCollapsibleSection title="Inspector" variant="panel" fill>
      {selected ? (
        <div className="space-y-3">
          <div
            className={cn(
              "flex items-center justify-between rounded-lg border bg-card/50 px-3 py-2",
              INSPECTOR_SECTION_BORDER_CLASS,
            )}
          >
            <span className={INSPECTOR_SECTION_TITLE_CLASS}>
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
      ) : (
        <div className="flex min-h-48 items-center justify-center text-center">
          <p className="text-xs text-muted-foreground">Select a step to view its config.</p>
        </div>
      )}
    </InspectorCollapsibleSection>
  )
}
