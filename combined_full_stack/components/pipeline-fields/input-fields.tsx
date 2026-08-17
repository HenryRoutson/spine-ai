"use client"

import { cn } from "@/lib/utils"
import { WARNING_TEXT_CLASS } from "@/lib/ui-classes"
import {
  INPUT_TYPES,
  type InputType,
  type PipelineModule,
  type StructureModel,
} from "@/lib/types"
import {
  inputTypeLabel,
  inputNameRestrictionLabel,
  inputTypesForModule,
  inputModuleNeedsDocToText,
  inputModuleTypesAreAllJsonNative,
  isDocToTextInputType,
  isJsonNativeInputType,
  isPlainTextInputType,
} from "@/lib/inference-input"
import {
  autoDocToTextStepForInput,
  autoStructureParseStepForInput,
  inputTargetStructureId,
} from "@/lib/structure-parse-steps"
import { isBuiltinDocumentModel, withSharedModels } from "@/lib/structure"
import {
  InvalidKind,
  IoMismatchFixKind,
  warningStepMessages,
  type InvalidStep,
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
  const needsConvert = inputModuleNeedsDocToText(selected)
  const allJsonNative = inputModuleTypesAreAllJsonNative(selected)
  const mergedModels = withSharedModels(models)
  const targetStructureId = inputTargetStructureId(selected, modules)
  const targetStructure = mergedModels.find((m) => m.id === targetStructureId)
  const autoParse = autoStructureParseStepForInput(modules, selected.id)
  const autoConvert = autoDocToTextStepForInput(modules, selected.id)
  const jsonNativeTypes = INPUT_TYPES.filter((t) => isJsonNativeInputType(t.value))
  const plainTextTypes = INPUT_TYPES.filter((t) => isPlainTextInputType(t.value))
  const convertTypes = INPUT_TYPES.filter((t) => isDocToTextInputType(t.value))

  return (
    <>
      <PipelineField
        label="Input types"
        hint={edit ? "JSON-native parses directly; plain text is already instantiated; PDF/Word/image/web get a locked Convert to text step" : undefined}
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
                Plain text · already instantiated
              </p>
              <div className="flex flex-wrap gap-1.5">
                {plainTextTypes.map((t) => {
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
                Needs convert to text (PDF, Word, image, web)
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
          ) : (
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              Upload → Document
              {needsConvert ? (
                <>
                  {" → "}
                  <span className="text-primary">{autoConvert?.label ?? "Convert to text"}</span>
                </>
              ) : null}
              {targetStructure && !isBuiltinDocumentModel(targetStructure) ? (
                <>
                  {" → "}
                  <span className="text-primary">{autoParse?.label ?? "Parse to structure"}</span>
                  {" → "}
                  <span className="text-foreground">{targetStructure.name}</span>
                </>
              ) : (
                <> (content {needsConvert ? "instantiated by convert step" : "already text"})</>
              )}
            </p>
          )}
        </div>
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
          invalid?.kind === InvalidKind.NoOutput ? "required — defines the structure this file is loaded into" : undefined
        }
        hintTone={invalid?.kind === InvalidKind.NoOutput ? "error" : "warning"}
      >
        {edit ? (
          <StructureModelSelect
            models={models}
            value={targetStructureId}
            onValueChange={(v) => onUpdate!({ outStructureId: v })}
            invalid={invalid?.kind === InvalidKind.NoOutput}
          />
        ) : (
          <StaticValue mono>
            <StructureLink models={models} structureId={targetStructureId} />
          </StaticValue>
        )}
        <IoMismatchFieldFix
          fix={ioMismatchFix?.kind === IoMismatchFixKind.AlignUpstream ? ioMismatchFix : undefined}
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
  onUpdate({ inputType: spec })
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
