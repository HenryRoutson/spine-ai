"use client"

import { cn } from "@/lib/utils"
import { WARNING_TEXT_CLASS } from "@/lib/ui-classes"
import {
  INPUT_TYPES,
  DOC_PARSE_MODES,
  docParseModeForModule,
  type InputType,
  type PipelineModule,
  type StructureModel,
} from "@/lib/types"
import {
  inputTypeLabel,
  inputNameRestrictionLabel,
  inputTypesForModule,
  inputTypesNeedOcr,
  inputModuleNeedsOcr,
  inputModuleTypesAreAllJsonNative,
  isJsonNativeInputType,
} from "@/lib/inference-input"
import {
  autoStructureParseStepForInput,
  inputTargetStructureId,
} from "@/lib/structure-parse-steps"
import { isBuiltinDocumentModel, withSharedModels } from "@/lib/structure"
import {
  warningStepMessages,
  type InvalidStep,
  type IoMismatchFixKind,
  type IoMismatchInspectorFix,
  type PipelineWarning,
} from "@/lib/validity"
import {
  formatModuleSpineOut,
  patchSpineOutList,
  resolveOutIsList,
} from "@/lib/spine-type"
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
  const allJsonNative = inputModuleTypesAreAllJsonNative(selected)
  const mergedModels = withSharedModels(models)
  const targetStructureId = inputTargetStructureId(selected, modules)
  const targetStructure = mergedModels.find((m) => m.id === targetStructureId)
  const autoParse = autoStructureParseStepForInput(modules, selected.id)
  const jsonNativeTypes = INPUT_TYPES.filter((t) => isJsonNativeInputType(t.value))
  const convertTypes = INPUT_TYPES.filter((t) => !isJsonNativeInputType(t.value))

  return (
    <>
      <PipelineField
        label="Input types"
        hint={edit ? "JSON-native types parse directly; others use a locked LLM convert step when a structure is selected" : undefined}
      >
        {edit ? (
          <div className="space-y-2">
            <div>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                JSON-native · direct parse
              </p>
              <div className="flex flex-wrap gap-1.5">
                {jsonNativeTypes.map((t) => {
                  const active = inputTypesForModule(selected).includes(t.value)
                  return (
                    <TypeChip
                      key={t.value}
                      label={t.label}
                      active={active}
                      tone="json"
                      onClick={() => toggleInputType(t.value, active, selected, onUpdate!)}
                    />
                  )
                })}
              </div>
            </div>
            <div>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                Needs LLM conversion if not Document I/O model.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {convertTypes.map((t) => {
                  const active = inputTypesForModule(selected).includes(t.value)
                  return (
                    <TypeChip
                      key={t.value}
                      label={t.label}
                      active={active}
                      tone="convert"
                      onClick={() => toggleInputType(t.value, active, selected, onUpdate!)}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <StaticValue>{inputTypeLabel(selected.inputType)}</StaticValue>
        )}
      </PipelineField>
      <PipelineField label="Structure loading">
        <div className="space-y-1 rounded-md border border-dashed border-border bg-secondary/20 px-3 py-2.5">
          {allJsonNative ? (
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              Upload → JSON parse →{" "}
              <span className="text-foreground">{targetStructure?.name ?? "structure"}</span>
            </p>
          ) : targetStructure && !isBuiltinDocumentModel(targetStructure) ? (
            <>
              <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                Upload → Document →{" "}
                <span className="text-primary">{autoParse?.label ?? "Parse to structure"}</span> →{" "}
                <span className="text-foreground">{targetStructure.name}</span>
              </p>
              <p className="font-mono text-[9px] leading-relaxed text-muted-foreground/80">
                Locked LLM step is inserted automatically — you only pick the target structure below.
              </p>
            </>
          ) : (
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              Upload → Document (raw text + filename)
            </p>
          )}
        </div>
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
                {resolveOutIsList(selected)
                  ? "multi-doc slot · list[structure]"
                  : "single-doc slot · one structure"}
              </p>
            </div>
            <Switch
              checked={resolveOutIsList(selected)}
              onCheckedChange={(v) =>
                onUpdate!({
                  ...patchSpineOutList(selected, v),
                  inputMinCount: v ? Math.max(2, selected.inputMinCount ?? 1) : undefined,
                })
              }
            />
          </div>
        ) : (
          <StaticValue>{resolveOutIsList(selected) ? "Multi-doc (list)" : "Single-doc"}</StaticValue>
        )}
      </PipelineField>
      {(resolveOutIsList(selected) || (selected.inputMinCount ?? 1) > 1) && (
        <PipelineField
          label="Minimum documents"
          hint={edit ? "required count when this slot accepts multiple files" : undefined}
        >
          {edit ? (
            <Input
              type="number"
              min={1}
              value={selected.inputMinCount ?? (resolveOutIsList(selected) ? 2 : 1)}
              onChange={(e) => {
                const n = Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                onUpdate!({ inputMinCount: n === 1 && !resolveOutIsList(selected) ? undefined : n })
              }}
              className="h-8 font-mono text-xs"
            />
          ) : (
            <StaticValue mono>{selected.inputMinCount ?? (resolveOutIsList(selected) ? 2 : 1)}</StaticValue>
          )}
        </PipelineField>
      )}
      {resolveOutIsList(selected) && selected.outStructureId && (
        <PipelineField label="Spine output type">
          <StaticValue mono>{formatModuleSpineOut(selected, models)}</StaticValue>
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
            value={targetStructureId}
            onValueChange={(v) => onUpdate!({ outStructureId: v })}
            invalid={invalid?.kind === "no-output"}
          />
        ) : (
          <StaticValue mono>
            <StructureLink models={models} structureId={targetStructureId} />
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

function toggleInputType(
  value: InputType,
  active: boolean,
  selected: PipelineModule,
  onUpdate: (patch: Partial<PipelineModule>) => void,
) {
  const current = inputTypesForModule(selected)
  const next = active ? current.filter((v) => v !== value) : [...current, value]
  if (!next.length) return
  const spec = next.length === 1 ? next[0]! : next
  const ocrOk = inputTypesNeedOcr(next)
  onUpdate({
    inputType: spec,
    useOcr: ocrOk ? selected.useOcr : undefined,
    model: ocrOk && selected.useOcr ? selected.model : undefined,
    prompt: ocrOk && selected.useOcr ? selected.prompt : undefined,
  })
}

function TypeChip({
  label,
  active,
  tone,
  onClick,
}: {
  label: string
  active: boolean
  tone: "json" | "convert"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
        active
          ? tone === "json"
            ? "border-chart-1 bg-chart-1/10 text-chart-1"
            : "border-chart-3 bg-chart-3/10 text-chart-3"
          : "border-border text-muted-foreground hover:border-muted-foreground/40",
      )}
    >
      {label}
    </button>
  )
}
