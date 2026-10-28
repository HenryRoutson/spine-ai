"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ModelSelector } from "@/components/model-selector"
import { ExampleSelectPromptCachePreview } from "@/components/example-select-prompt-cache-preview"
import { formatCostCents } from "@/lib/format"
import {
  formatCostLimitUsdInput,
  llmStepCostLimitCents,
  parseCostLimitUsdInput,
} from "@/lib/llm-cost-limit"
import {
  DEFAULT_EXAMPLE_SELECT_PROMPT,
  DEFAULT_EXAMPLE_REASON_FIELD,
} from "@/lib/example-select"
import type { PipelineModule } from "@/lib/types"
import { PipelineField, StaticValue, llmModelLabel } from "@/components/pipeline-fields/shared"

type ExampleSelectModuleFieldsProps = {
  selected: PipelineModule
  priorLabels: string[]
  edit: boolean
  globalModel?: string
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

export function ExampleSelectModuleFields({
  selected,
  priorLabels,
  edit,
  globalModel,
  onUpdate,
}: ExampleSelectModuleFieldsProps) {
  const costLimitCents = llmStepCostLimitCents(selected)
  const promptTemplate = selected.prompt?.trim() || DEFAULT_EXAMPLE_SELECT_PROMPT

  return (
    <>
      <PipelineField label="Model" hint="cheap model is fine — e.g. DeepSeek Flash">
        {edit ? (
          <ModelSelector
            value={selected.model ?? globalModel ?? ""}
            onChange={(v) => onUpdate!({ model: v })}
          />
        ) : (
          <StaticValue mono>{llmModelLabel(selected.model)}</StaticValue>
        )}
      </PipelineField>

      <PipelineField label="Cost limit" hint="max spend for this step per run">
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
      <PipelineField
        label="Context step label"
        hint="Prior step output fills {description} in the prompt — must match an earlier step label"
      >
        {edit ? (
          <Input
            value={selected.exampleContextLabel ?? ""}
            onChange={(e) => onUpdate!({ exampleContextLabel: e.target.value })}
            placeholder="e.g. Works description"
            className="h-8 font-mono text-xs"
            list="example-select-context-labels"
          />
        ) : (
          <StaticValue mono>{selected.exampleContextLabel?.trim() || "—"}</StaticValue>
        )}
        {edit && priorLabels.length > 0 && (
          <datalist id="example-select-context-labels">
            {priorLabels.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        )}
      </PipelineField>

      <PipelineField
        label="Context field"
        hint="optional dot path within that step — omit to stringify the whole output. FKs in this context that point at the candidate catalog are expanded (description/code/…) for the prompt only; kept rows stay normalized."
      >
        {edit ? (
          <Input
            value={selected.exampleContextField ?? ""}
            onChange={(e) => onUpdate!({ exampleContextField: e.target.value })}
            placeholder="e.g. description"
            className="h-8 font-mono text-xs"
          />
        ) : (
          <StaticValue mono>{selected.exampleContextField?.trim() || "—"}</StaticValue>
        )}
      </PipelineField>

      <PipelineField
        label="Reason field"
        hint={`text field on each output item for chain_of_thought — default ${DEFAULT_EXAMPLE_REASON_FIELD}`}
      >
        {edit ? (
          <Input
            value={selected.exampleReasonField ?? ""}
            onChange={(e) => onUpdate!({ exampleReasonField: e.target.value })}
            placeholder={DEFAULT_EXAMPLE_REASON_FIELD}
            className="h-8 font-mono text-xs"
          />
        ) : (
          <StaticValue mono>{selected.exampleReasonField?.trim() || DEFAULT_EXAMPLE_REASON_FIELD}</StaticValue>
        )}
      </PipelineField>

      <PipelineField
        label="Pre-filter max"
        hint="optional cap on candidates before per-item relevance LLM calls — use with a cheap upstream filter later"
      >
        {edit ? (
          <Input
            type="number"
            min={1}
            value={selected.examplePreFilterMax ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim()
              onUpdate!({ examplePreFilterMax: raw ? Number(raw) : undefined })
            }}
            placeholder="all candidates"
            className="h-8 font-mono text-xs"
          />
        ) : (
          <StaticValue mono>
            {selected.examplePreFilterMax != null ? String(selected.examplePreFilterMax) : "all"}
          </StaticValue>
        )}
      </PipelineField>

      {/* AI : TODO (example-select-view) — Prompt fields picker (dual of Context field): which keys of each
          candidate go into {example}. Default all. Billed-work pass 1: title, work_description only. */}
      <PipelineField
        label="Prompt view"
        hint="uncached {example} columns — spine still the full row. Empty = all fields."
      >
        {edit ? (
          <Textarea
            value={selected.examplePromptView ?? ""}
            onChange={(e) => onUpdate!({ examplePromptView: e.target.value || undefined })}
            placeholder="SELECT id, title, work_description FROM job_example"
            className="min-h-20 resize-y font-mono text-xs leading-relaxed"
          />
        ) : (
          <StaticValue mono pre>
            {selected.examplePromptView?.trim() || "all fields"}
          </StaticValue>
        )}
      </PipelineField>
      <PipelineField
        label="Relevance prompt"
        hint="schema-first cached prefix · {description} per run · {example} last per candidate"
      >
        {edit ? (
          <div className="space-y-3">
            <Textarea
              value={selected.prompt ?? DEFAULT_EXAMPLE_SELECT_PROMPT}
              onChange={(e) => onUpdate!({ prompt: e.target.value })}
              className="min-h-32 resize-y font-mono text-xs leading-relaxed"
            />
            <ExampleSelectPromptCachePreview template={promptTemplate} />
          </div>
        ) : (
          <div className="space-y-3">
            <StaticValue mono pre>
              {promptTemplate}
            </StaticValue>
            <ExampleSelectPromptCachePreview template={promptTemplate} />
          </div>
        )}
      </PipelineField>
    </>
  )
}
