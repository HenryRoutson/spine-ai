"use client"

// AI : primitives shared across all pipeline field sub-components.
import { useMemo } from "react"
import { llmSchemaJson } from "@/lib/structure"
import { isLlmKind } from "@/lib/module-kinds"
import { cn } from "@/lib/utils"
import {
  MODEL_OPTIONS,
  type PipelineModule,
  type StructureModel,
  type StructureModelId,
} from "@/lib/types"
import {
  type InvalidStep,
  type IoMismatchFixKind,
  type IoMismatchInspectorFix,
} from "@/lib/validity"
import { ModelSelector } from "@/components/model-selector"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function llmModelLabel(id?: string) {
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
            hintTone === "error" ? "text-destructive" : "WARNING_TEXT_CLASS",
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

export function StructureModelSelect({
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

export function IoMismatchFieldFix({
  fix,
  edit,
  onFix,
}: {
  fix?: IoMismatchInspectorFix
  edit: boolean
  onFix?: (mismatchModuleId: string, kind: IoMismatchFixKind) => void
}) {
  if (!fix) return null
  return (
    <div className="mt-2 space-y-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2">
      <p className="font-mono text-[10px] leading-relaxed text-destructive">{fix.message}</p>
      {fix.label && edit && onFix ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-destructive/40 font-mono text-[10px] text-destructive hover:bg-destructive/10"
          onClick={() => onFix(fix.mismatchModuleId, fix.kind)}
        >
          {fix.label}
        </Button>
      ) : null}
    </div>
  )
}

export function OcrExtraFields({
  selected,
  edit,
  onUpdate,
}: {
  selected: PipelineModule
  edit: boolean
  onUpdate: (patch: Partial<PipelineModule>) => void
}) {
  return (
    <>
      <PipelineField label="Vision model">
        {edit ? (
          <ModelSelector
            value={selected.model ?? "gemini-3-flash"}
            onChange={(v) => onUpdate({ model: v })}
          />
        ) : (
          <StaticValue mono>{llmModelLabel(selected.model ?? "gemini-3-flash")}</StaticValue>
        )}
      </PipelineField>
      <PipelineField label="OCR prompt" hint={edit ? "optional — extra transcription instructions" : undefined}>
        {edit ? (
          <Textarea
            value={selected.prompt ?? ""}
            onChange={(e) => onUpdate({ prompt: e.target.value })}
            placeholder="e.g. preserve table columns; read handwritten amounts carefully…"
            className="min-h-20 resize-y text-xs leading-relaxed"
          />
        ) : (
          <StaticValue mono pre>
            {selected.prompt?.trim() ? selected.prompt : "—"}
          </StaticValue>
        )}
      </PipelineField>
    </>
  )
}
