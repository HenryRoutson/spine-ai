"use client"

import { JsonHighlight } from "@/components/highlight"
import { ModelSelector } from "@/components/model-selector"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatCostCents } from "@/lib/format"
import {
  formatCostLimitUsdInput,
  llmStepCostLimitCents,
  parseCostLimitUsdInput,
} from "@/lib/llm-cost-limit"
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
  const costLimitCents = llmStepCostLimitCents(selected)

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
      <PipelineField label="Cost limit" hint="max spend for this step per run — includes input guard + LLM calls">
        {edit ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={formatCostLimitUsdInput(costLimitCents)}
              onChange={(e) => {
                const cents = parseCostLimitUsdInput(e.target.value)
                if (cents != null) onUpdate!({ costLimitCents: cents })
              }}
              className="h-8 font-mono text-xs"
            />
          </div>
        ) : (
          <StaticValue mono>{formatCostCents(costLimitCents)}</StaticValue>
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
