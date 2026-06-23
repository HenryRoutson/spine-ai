"use client"

import { useMemo } from "react"
import { JsonHighlight } from "@/components/highlight"
import { ModelSelector } from "@/components/model-selector"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AUTO_QUOTE_EXPLAINER, isAutoQuoteStep } from "@/lib/quote-steps"
import { llmSchemaJson } from "@/lib/structure"
import { isLlmKind } from "@/lib/module-kinds"
import {
  INPUT_TYPES,
  MODEL_OPTIONS,
  MODULE_META,
  type PipelineModule,
  type StructureModel,
  type StructureModelId,
} from "@/lib/types"
import { inputTypeLabel, inputNameRestrictionLabel, inputTypesForModule } from "@/lib/inference-input"
import {
  invalidStepMessage,
  modelName,
  warningStepMessage,
  type InvalidStep,
  type PipelineWarning,
} from "@/lib/validity"
import { cn } from "@/lib/utils"

function llmModelLabel(id?: string) {
  return MODEL_OPTIONS.find((m) => m.id === id)?.label ?? id ?? "—"
}

export function useLlmSchemaPreview(selected: PipelineModule | undefined, models: StructureModel[]) {
  return useMemo(() => {
    if (!selected || !isLlmKind(selected.kind) || !selected.outStructureId) return null
    const out = models.find((m) => m.id === selected.outStructureId)
    if (!out) return null
    const isList = selected.outIsList || selected.kind === "llm-batch"
    return llmSchemaJson(out, models, isList)
  }, [selected, models])
}

export function PipelineField({
  label,
  hint,
  hintTone = "warning",
  children,
}: {
  label: string
  hint?: string
  hintTone?: "warning" | "error"
  children: React.ReactNode
}) {
  return (
    <div className="mb-3 min-w-0">
      <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {hint && (
        <p
          className={cn(
            "mb-1.5 font-mono text-[10px]",
            hintTone === "error" ? "text-destructive" : "text-amber-600 dark:text-amber-500",
          )}
        >
          {hint}
        </p>
      )}
      {children}
    </div>
  )
}

export function StaticValue({ children, mono, pre }: { children?: React.ReactNode; mono?: boolean; pre?: boolean }) {
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

function StructureModelSelect({
  models,
  value,
  onValueChange,
  invalid,
}: {
  models: StructureModel[]
  value: StructureModelId | undefined
  onValueChange: (v: StructureModelId | undefined) => void
  invalid?: boolean
}) {
  const items = useMemo(() => models.map((m) => ({ value: m.id, label: m.name })), [models])
  return (
    <Select
      value={value ?? null}
      onValueChange={(v) => onValueChange((v ?? undefined) as StructureModelId | undefined)}
      items={items}
    >
      <SelectTrigger className={cn("h-8 font-mono text-xs", invalid && "border-destructive/70")}>
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {models.map((m) => (
          <SelectItem key={m.id} value={m.id} label={m.name} className="font-mono text-xs">
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type PipelineModuleFieldsProps = {
  module: PipelineModule
  models: StructureModel[]
  modules: PipelineModule[]
  mode: "edit" | "view"
  globalModel?: string
  invalid?: InvalidStep
  warning?: PipelineWarning
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

// AI : shared inspector field layout — editable in Pipeline builder, static in Logging.
export function PipelineModuleFields({
  module: selected,
  models,
  modules,
  mode,
  globalModel,
  invalid,
  warning,
  onUpdate,
}: PipelineModuleFieldsProps) {
  const llmSchemaPreview = useLlmSchemaPreview(selected, models)
  const edit = mode === "edit" && onUpdate

  if (isAutoQuoteStep(selected)) {
    return (
      <>
        <p className="mb-3 font-mono text-[10px] leading-relaxed text-muted-foreground">{AUTO_QUOTE_EXPLAINER}</p>
        <PipelineField label="Structure">
          {edit ? (
            <p className="rounded-md border border-chart-2/30 bg-chart-2/5 px-2.5 py-2 font-mono text-xs">
              {modelName(models, selected.inStructureId) ?? "·"}
              <span className="text-muted-foreground"> → </span>
              {modelName(models, selected.outStructureId) ?? "·"}
              <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                same model — LLM emits strings, this step attaches source spans
              </span>
            </p>
          ) : (
            <StaticValue mono>
              {modelName(models, selected.inStructureId) ?? "·"}
              <span className="text-muted-foreground"> → </span>
              {modelName(models, selected.outStructureId) ?? "·"}
              <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                same model — LLM emits strings, this step attaches source spans
              </span>
            </StaticValue>
          )}
        </PipelineField>
        <PipelineField label="Cache results">
          {edit ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium">Cache results</p>
                <p className="font-mono text-[10px] text-muted-foreground">skip recompute &amp; billing</p>
              </div>
              <Switch checked={selected.cached} onCheckedChange={(v) => onUpdate!({ cached: v })} />
            </div>
          ) : (
            <StaticValue>{selected.cached ? "On" : "Off"}</StaticValue>
          )}
        </PipelineField>
      </>
    )
  }

  return (
    <>
      <p className="mb-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
        {MODULE_META[selected.kind].description}
      </p>
      {invalid && (
        <p className="mb-3 font-mono text-[10px] leading-relaxed text-destructive">
          {invalidStepMessage(invalid, models, modules)}
        </p>
      )}
      {warning && (
        <p className="mb-3 font-mono text-[10px] leading-relaxed text-amber-600 dark:text-amber-500">
          {warningStepMessage(warning, models, modules)}
        </p>
      )}

      <PipelineField label="Label">
        {edit ? (
          <Input
            value={selected.label}
            onChange={(e) => onUpdate!({ label: e.target.value })}
            className="h-8 text-sm"
          />
        ) : (
          <StaticValue>{selected.label}</StaticValue>
        )}
      </PipelineField>

      {(selected.kind === "doc-to-text" || selected.kind === "combine" || isLlmKind(selected.kind)) && (
        <PipelineField label="Annotation / purpose">
          {edit ? (
            <Input
              value={selected.note ?? ""}
              onChange={(e) => onUpdate!({ note: e.target.value })}
              placeholder="describe what this step does…"
              className="h-8 text-xs"
            />
          ) : (
            <StaticValue>{selected.note}</StaticValue>
          )}
        </PipelineField>
      )}

      {selected.kind === "input" && (
        <>
          <PipelineField label="Input types">
            {edit ? (
              <div className="flex flex-wrap gap-1.5">
                {INPUT_TYPES.map((t) => {
                  const active = inputTypesForModule(selected).includes(t.value)
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        const current = inputTypesForModule(selected)
                        const next = active ? current.filter((v) => v !== t.value) : [...current, t.value]
                        if (!next.length) return
                        onUpdate!({ inputType: next.length === 1 ? next[0] : next })
                      }}
                      className={cn(
                        "rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40",
                      )}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <StaticValue>{inputTypeLabel(selected.inputType)}</StaticValue>
            )}
          </PipelineField>
          <PipelineField
            label="Filename must contain"
            hint={edit ? "optional — only documents whose name includes this text can be assigned to this input" : undefined}
          >
            {edit ? (
              <Input
                value={selected.inputNameContains ?? ""}
                onChange={(e) => onUpdate!({ inputNameContains: e.target.value.trim() || undefined })}
                placeholder='e.g. "legal_requirements", "company_legal_compliance"'
                className="h-8 font-mono text-xs"
              />
            ) : inputNameRestrictionLabel(selected) ? (
              <StaticValue mono>{inputNameRestrictionLabel(selected)}</StaticValue>
            ) : null}
          </PipelineField>
          <PipelineField
            label="I/O model"
            hint={
              invalid?.kind === "no-output" ? "required — defines the structure this file is loaded into" : undefined
            }
            hintTone={invalid?.kind === "no-output" ? "error" : "warning"}
          >
            {edit ? (
              <StructureModelSelect
                models={models}
                value={selected.outStructureId}
                onValueChange={(v) => onUpdate!({ outStructureId: v })}
                invalid={invalid?.kind === "no-output"}
              />
            ) : (
              <StaticValue mono>{modelName(models, selected.outStructureId)}</StaticValue>
            )}
          </PipelineField>
        </>
      )}

      {selected.kind !== "input" && (
        <PipelineField
          label={selected.kind === "output" ? "Structure to materialize" : "Input model"}
          hint={
            selected.kind === "output" && invalid?.kind === "no-output"
              ? "required — pick the structure this step snapshots"
              : undefined
          }
          hintTone={selected.kind === "output" && invalid?.kind === "no-output" ? "error" : "warning"}
        >
          {edit ? (
            <StructureModelSelect
              models={models}
              value={selected.inStructureId}
              onValueChange={(v) => onUpdate!({ inStructureId: v })}
              invalid={selected.kind === "output" && invalid?.kind === "no-output"}
            />
          ) : (
            <StaticValue mono>{modelName(models, selected.inStructureId)}</StaticValue>
          )}
        </PipelineField>
      )}

      {selected.kind !== "input" && selected.kind !== "output" && (
        <PipelineField
          label="Output model"
          hint={invalid?.kind === "no-output" ? "required — step must emit a structure" : undefined}
          hintTone={invalid?.kind === "no-output" ? "error" : "warning"}
        >
          {edit ? (
            <StructureModelSelect
              models={models}
              value={selected.outStructureId}
              onValueChange={(v) => onUpdate!({ outStructureId: v })}
              invalid={invalid?.kind === "no-output"}
            />
          ) : (
            <StaticValue mono>{modelName(models, selected.outStructureId)}</StaticValue>
          )}
        </PipelineField>
      )}

      {isLlmKind(selected.kind) && (
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
          <PipelineField label={warning?.kind === "no-prompt" ? "Prompt · optional" : "Prompt"}>
            {edit ? (
              <>
                <Textarea
                  value={selected.prompt ?? ""}
                  onChange={(e) => onUpdate!({ prompt: e.target.value })}
                  placeholder="Extra instruction (schema below also guides the model)…"
                  className="min-h-32 resize-y text-xs leading-relaxed"
                />
                {warning?.kind === "no-prompt" && (
                  <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                    no custom text — JSON schema is sent as the structured output contract
                  </p>
                )}
                {warning?.kind === "unused-output" && (
                  <p className="mt-1 font-mono text-[9px] text-amber-600 dark:text-amber-500">
                    {warningStepMessage(warning, models, modules)}
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
      )}

      {selected.kind === "custom-code" && (
        <PipelineField label="TypeScript · (input) => output">
          {edit ? (
            <Textarea
              value={selected.code ?? ""}
              onChange={(e) => onUpdate!({ code: e.target.value })}
              className="min-h-32 bg-[oklch(0.14_0.004_264)] font-mono text-[11px] leading-relaxed"
              spellCheck={false}
            />
          ) : (
            <StaticValue mono pre>
              {selected.code}
            </StaticValue>
          )}
        </PipelineField>
      )}

      <PipelineField label="Cache results">
        {edit ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium">Cache results</p>
              <p className="font-mono text-[10px] text-muted-foreground">skip recompute &amp; billing</p>
            </div>
            <Switch checked={selected.cached} onCheckedChange={(v) => onUpdate!({ cached: v })} />
          </div>
        ) : (
          <StaticValue>{selected.cached ? "On" : "Off"}</StaticValue>
        )}
      </PipelineField>
    </>
  )
}
