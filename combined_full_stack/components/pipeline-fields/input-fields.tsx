"use client"

import { cn } from "@/lib/utils"
import { WARNING_TEXT_CLASS } from "@/lib/ui-classes"
import {
  INPUT_TYPES,
  DOC_PARSE_MODES,
  docParseModeForModule,
  type PipelineModule,
  type StructureModel,
} from "@/lib/types"
import {
  inputTypeLabel,
  inputNameRestrictionLabel,
  inputTypesForModule,
  inputTypesNeedOcr,
  inputModuleNeedsOcr,
} from "@/lib/inference-input"
import {
  warningStepMessages,
  type InvalidStep,
  type IoMismatchFixKind,
  type IoMismatchInspectorFix,
  type PipelineWarning,
} from "@/lib/validity"
import { StructureLink } from "@/components/structure-link"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  PipelineField,
  StaticValue,
  StructureModelSelect,
  IoMismatchFieldFix,
  OcrExtraFields,
} from "@/components/pipeline-fields/shared"

type InputModuleFieldsProps = {
  selected: PipelineModule
  models: StructureModel[]
  modules: PipelineModule[]
  edit: boolean
  invalid?: InvalidStep
  warnings?: PipelineWarning[]
  ioMismatchFix?: IoMismatchInspectorFix
  onUpdate?: (patch: Partial<PipelineModule>) => void
  onFixIoMismatch?: (mismatchModuleId: string, kind: IoMismatchFixKind) => void
}

export function InputModuleFields({
  selected,
  models,
  modules,
  edit,
  invalid,
  warnings,
  ioMismatchFix,
  onUpdate,
  onFixIoMismatch,
}: InputModuleFieldsProps) {
  const inputOcrAvailable = inputModuleNeedsOcr(selected)

  return (
    <>
      <PipelineField
        label="Input types"
        hint={edit ? "enable PDF and/or Image to unlock Use OCR below" : undefined}
      >
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
                    const spec = next.length === 1 ? next[0]! : next
                    const ocrOk = inputTypesNeedOcr(next)
                    onUpdate!({
                      inputType: spec,
                      useOcr: ocrOk ? selected.useOcr : undefined,
                      model: ocrOk && selected.useOcr ? selected.model : undefined,
                      prompt: ocrOk && selected.useOcr ? selected.prompt : undefined,
                    })
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
      {inputOcrAvailable && (
        <PipelineField
          label="Conversion"
          hint={edit ? "Built-in parser at upload, or vision OCR for scans and handwriting" : undefined}
        >
          {edit ? (
            <div className="space-y-3 rounded-md border border-dashed border-chart-3/40 bg-chart-3/5 p-3">
              <p className="font-mono text-[10px] text-muted-foreground">
                Built-in parser runs at upload (PDF.js → docs.content). Vision OCR runs via OpenRouter and is cached separately.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DOC_PARSE_MODES.map((mode) => {
                  const active = docParseModeForModule(selected) === mode.value
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() =>
                        onUpdate!({
                          useOcr: mode.value === "llm" ? true : undefined,
                          model: mode.value === "llm" ? selected.model ?? "gemini-3-flash" : undefined,
                          prompt: mode.value === "llm" ? selected.prompt : undefined,
                        })
                      }
                      className={cn(
                        "rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40",
                      )}
                      title={mode.hint}
                    >
                      {mode.label}
                    </button>
                  )
                })}
              </div>
              {docParseModeForModule(selected) === "llm" && onUpdate && (
                <OcrExtraFields selected={selected} edit={!!edit} onUpdate={onUpdate} />
              )}
            </div>
          ) : (
            <StaticValue>
              {DOC_PARSE_MODES.find((m) => m.value === docParseModeForModule(selected))?.label ??
                "Built-in parser"}
            </StaticValue>
          )}
        </PipelineField>
      )}
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
        label="Multiple documents"
        hint={
          edit
            ? "when on, inference lets you add many files and this step emits a list on the pipeline spine"
            : undefined
        }
      >
        {edit ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium">Emit list output</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {selected.outIsList ? "multi-doc slot · list[structure]" : "single-doc slot · one structure"}
              </p>
            </div>
            <Switch
              checked={!!selected.outIsList}
              onCheckedChange={(v) =>
                onUpdate!({
                  outIsList: v || undefined,
                  inputMinCount: v ? Math.max(2, selected.inputMinCount ?? 1) : undefined,
                })
              }
            />
          </div>
        ) : (
          <StaticValue>{selected.outIsList ? "Multi-doc (list)" : "Single-doc"}</StaticValue>
        )}
      </PipelineField>
      {(selected.outIsList || (selected.inputMinCount ?? 1) > 1) && (
        <PipelineField
          label="Minimum documents"
          hint={edit ? "required count when this slot accepts multiple files" : undefined}
        >
          {edit ? (
            <Input
              type="number"
              min={1}
              value={selected.inputMinCount ?? (selected.outIsList ? 2 : 1)}
              onChange={(e) => {
                const n = Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                onUpdate!({ inputMinCount: n === 1 && !selected.outIsList ? undefined : n })
              }}
              className="h-8 font-mono text-xs"
            />
          ) : (
            <StaticValue mono>{selected.inputMinCount ?? (selected.outIsList ? 2 : 1)}</StaticValue>
          )}
        </PipelineField>
      )}
      {selected.outIsList && selected.outStructureId && (
        <PipelineField label="Output shape">
          <StaticValue mono>
            list[
            {models.find((m) => m.id === selected.outStructureId)?.name ?? "structure"}]
          </StaticValue>
        </PipelineField>
      )}
      {warnings?.length ? (
        <div className="space-y-1">
          {warningStepMessages(warnings, models, modules).map((msg, i) => (
            <p key={i} className={cn("font-mono text-[10px] leading-relaxed", WARNING_TEXT_CLASS)}>
              {msg}
            </p>
          ))}
        </div>
      ) : null}
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
          <StaticValue mono>
            <StructureLink models={models} structureId={selected.outStructureId} />
          </StaticValue>
        )}
        <IoMismatchFieldFix
          fix={ioMismatchFix?.kind === "align-upstream" ? ioMismatchFix : undefined}
          edit={!!edit}
          onFix={onFixIoMismatch}
        />
      </PipelineField>
    </>
  )
}
