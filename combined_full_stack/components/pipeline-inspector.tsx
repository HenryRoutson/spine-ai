"use client"

import { useMemo } from "react"
import { Lock } from "lucide-react"
import { JsonHighlight } from "@/components/highlight"
import { AUTO_QUOTE_EXPLAINER, isAutoQuoteStep } from "@/lib/quote-steps"
import { llmSchemaJson } from "@/lib/structure"
import {
  INPUT_TYPES,
  MODEL_OPTIONS,
  MODULE_META,
  type ModuleKind,
  type PipelineModule,
  type StructureModel,
} from "@/lib/types"
import { cn } from "@/lib/utils"

const LLM_KINDS: ModuleKind[] = ["llm", "llm-batch"]

function modelName(models: StructureModel[], id?: string) {
  return models.find((m) => m.id === id)?.name
}

function llmModelLabel(id?: string) {
  return MODEL_OPTIONS.find((m) => m.id === id)?.label ?? id ?? "—"
}

function inputTypeLabel(value?: string) {
  return INPUT_TYPES.find((t) => t.value === value)?.label ?? value ?? "—"
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function StaticValue({ children, mono, pre }: { children?: React.ReactNode; mono?: boolean; pre?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-secondary/30 px-2.5 py-2 text-sm",
        mono && "font-mono text-xs",
        pre && "whitespace-pre-wrap leading-relaxed",
      )}
    >
      {children ?? <span className="text-muted-foreground">—</span>}
    </div>
  )
}

type PipelineInspectorProps = {
  module: PipelineModule | undefined
  models: StructureModel[]
}

// AI : read-only mirror of the Pipeline tab inspector — prompts, I/O, code, schema.
export function PipelineInspector({ module: selected, models }: PipelineInspectorProps) {
  const llmSchemaPreview = useMemo(() => {
    if (!selected || !LLM_KINDS.includes(selected.kind) || !selected.outStructureId) return null
    const out = models.find((m) => m.id === selected.outStructureId)
    if (!out) return null
    const isList = selected.outIsList || selected.kind === "llm-batch"
    return llmSchemaJson(out, models, isList)
  }, [selected, models])

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

      {isAutoQuoteStep(selected) ? (
        <>
          <p className="mb-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {AUTO_QUOTE_EXPLAINER}
          </p>
          <Field label="Structure">
            <StaticValue mono>
              {modelName(models, selected.inStructureId) ?? "·"}
              <span className="text-muted-foreground"> → </span>
              {modelName(models, selected.outStructureId) ?? "·"}
              <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                same model — LLM emits strings, this step attaches source spans
              </span>
            </StaticValue>
          </Field>
          <Field label="Cache results">
            <StaticValue>{selected.cached ? "On" : "Off"}</StaticValue>
          </Field>
        </>
      ) : (
        <>
          <p className="mb-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {MODULE_META[selected.kind].description}
          </p>

          <Field label="Label">
            <StaticValue>{selected.label}</StaticValue>
          </Field>

          {(selected.kind === "doc-to-text" ||
            selected.kind === "combine" ||
            LLM_KINDS.includes(selected.kind)) && (
            <Field label="Annotation / purpose">
              <StaticValue>{selected.note}</StaticValue>
            </Field>
          )}

          {selected.kind === "input" && (
            <>
              <Field label="Input type">
                <StaticValue>{inputTypeLabel(selected.inputType)}</StaticValue>
              </Field>
              <Field label="I/O model">
                <StaticValue mono>{modelName(models, selected.outStructureId)}</StaticValue>
              </Field>
            </>
          )}

          {selected.kind !== "input" && (
            <Field label={selected.kind === "output" ? "Structure to materialize" : "Input model"}>
              <StaticValue mono>{modelName(models, selected.inStructureId)}</StaticValue>
            </Field>
          )}

          {selected.kind !== "input" && selected.kind !== "output" && (
            <Field label="Output model">
              <StaticValue mono>{modelName(models, selected.outStructureId)}</StaticValue>
            </Field>
          )}

          {LLM_KINDS.includes(selected.kind) && (
            <>
              <Field label="Model">
                <StaticValue mono>{llmModelLabel(selected.model)}</StaticValue>
              </Field>
              <Field label="Prompt">
                <StaticValue mono pre>
                  {selected.prompt?.trim() ? selected.prompt : "—"}
                </StaticValue>
              </Field>
              {llmSchemaPreview && (
                <Field
                  label={
                    selected.kind === "llm-batch"
                      ? "Output schema · per item"
                      : "Output schema · Zod → JSON Schema"
                  }
                >
                  <div className="max-h-64 min-w-0 overflow-auto rounded-md border border-border bg-[oklch(0.14_0.004_264)] p-2">
                    <JsonHighlight json={llmSchemaPreview} />
                  </div>
                </Field>
              )}
            </>
          )}

          {selected.kind === "custom-code" && (
            <Field label="TypeScript · (input) => output">
              <StaticValue mono pre>
                {selected.code}
              </StaticValue>
            </Field>
          )}

          <Field label="Cache results">
            <StaticValue>{selected.cached ? "On" : "Off"}</StaticValue>
          </Field>
        </>
      )}
    </div>
  )
}
