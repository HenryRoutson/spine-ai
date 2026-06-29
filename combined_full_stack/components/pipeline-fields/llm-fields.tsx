"use client"

import { JsonHighlight } from "@/components/highlight"
import { ModelSelector } from "@/components/model-selector"
import { Textarea } from "@/components/ui/textarea"
import type { PipelineModule, StructureModel } from "@/lib/types"
import { PipelineField, StaticValue, llmModelLabel } from "@/components/pipeline-fields/shared"

type LlmModuleFieldsProps = {
  selected: PipelineModule
  models: StructureModel[]
  edit: boolean
  globalModel?: string
  hasNoPromptWarning: boolean
  llmSchemaPreview: string | null
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

export function LlmModuleFields({
  selected,
  edit,
  globalModel,
  hasNoPromptWarning,
  llmSchemaPreview,
  onUpdate,
}: LlmModuleFieldsProps) {
  return (
    <>
      <PipelineField label="Model">
        {edit ? (
          <ModelSelector
            value={selected.model ?? globalModel ?? ""}
            onChange={(v) => onUpdate!({ model: v })}
          />
        ) : (
          <StaticValue mono>{llmModelLabel(selected.model)}</StaticValue>
        )}
      </PipelineField>
      <PipelineField label={hasNoPromptWarning ? "Prompt · optional" : "Prompt"}>
        {edit ? (
          <>
            <Textarea
              value={selected.prompt ?? ""}
              onChange={(e) => onUpdate!({ prompt: e.target.value })}
              placeholder="Extra instruction (schema below also guides the model)…"
              className="min-h-32 resize-y text-xs leading-relaxed"
            />
            {hasNoPromptWarning && (
              <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                no custom text — JSON schema is sent as the structured output contract
              </p>
            )}
          </>
        ) : (
          <StaticValue mono pre>
            {selected.prompt?.trim() ? selected.prompt : "—"}
          </StaticValue>
        )}
      </PipelineField>
      {llmSchemaPreview && (
        <PipelineField
          label={
            selected.kind === "llm-batch"
              ? "Output schema · per item"
              : "Output schema · Zod → JSON Schema"
          }
        >
          <div className="max-h-64 min-w-0 overflow-auto rounded-md border border-border bg-[oklch(0.14_0.004_264)] p-2">
            <JsonHighlight json={llmSchemaPreview} />
          </div>
        </PipelineField>
      )}
    </>
  )
}
