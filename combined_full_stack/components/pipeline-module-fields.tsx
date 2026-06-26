"use client"

import { useMemo } from "react"
import { WARNING_TEXT_CLASS } from "@/lib/ui-classes"
import { Plus, Trash2 } from "lucide-react"
import { CustomCodeEditor } from "@/components/custom-code-editor"
import { JsonHighlight } from "@/components/highlight"
import { ModelSelector } from "@/components/model-selector"
import { Button } from "@/components/ui/button"
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
  DOC_PARSE_MODES,
  INPUT_TYPES,
  MODEL_OPTIONS,
  MODULE_META,
  docParseModeForModule,
  type CustomCodeLanguage,
  type PipelineModule,
  type StructureModel,
  type StructureModelId,
} from "@/lib/types"
import { codeOfEntry, languageOfEntry, makeCustomCodeEntry } from "@/lib/custom_code_entries"
import { inputTypeLabel, inputNameRestrictionLabel, inputTypesForModule, inputTypesNeedOcr, inputModuleNeedsOcr, upstreamInputModule } from "@/lib/inference-input"
import {
  invalidStepMessage,
  warningStepMessages,
  type InvalidStep,
  type IoMismatchFixKind,
  type IoMismatchInspectorFix,
  type PipelineWarning,
} from "@/lib/validity"
import { StructureLink } from "@/components/structure-link"
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

function IoMismatchFieldFix({
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

function OcrExtraFields({
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

type PipelineModuleFieldsProps = {
  module: PipelineModule
  models: StructureModel[]
  modules: PipelineModule[]
  mode: "edit" | "view"
  globalModel?: string
  invalid?: InvalidStep
  invalidIssues?: InvalidStep[]
  warnings?: PipelineWarning[]
  ioMismatchFix?: IoMismatchInspectorFix
  onUpdate?: (patch: Partial<PipelineModule>) => void
  onFixIoMismatch?: (mismatchModuleId: string, kind: IoMismatchFixKind) => void
}

// AI : shared inspector field layout — editable in Pipeline builder, static in Logging.
export function PipelineModuleFields({
  module: selected,
  models,
  modules,
  mode,
  globalModel,
  invalid,
  invalidIssues,
  warnings,
  ioMismatchFix,
  onUpdate,
  onFixIoMismatch,
}: PipelineModuleFieldsProps) {
  const llmSchemaPreview = useLlmSchemaPreview(selected, models)
  const edit = mode === "edit" && onUpdate
  const hasNoPromptWarning = warnings?.some((w) => w.kind === "no-prompt")
  const inputOcrAvailable = selected.kind === "input" && inputModuleNeedsOcr(selected)
  const docToTextOcrAvailable =
    selected.kind === "doc-to-text" &&
    (() => {
      const upstream = upstreamInputModule(selected, modules)
      return upstream ? inputTypesNeedOcr(inputTypesForModule(upstream)) : false
    })()

  if (isAutoQuoteStep(selected)) {
    return (
      <>
        <p className="mb-3 font-mono text-[10px] leading-relaxed text-muted-foreground">{AUTO_QUOTE_EXPLAINER}</p>
        <PipelineField label="Structure">
          {edit ? (
            <p className="rounded-md border border-chart-2/30 bg-chart-2/5 px-2.5 py-2 font-mono text-xs">
              <StructureLink models={models} structureId={selected.inStructureId} />
              <span className="text-muted-foreground"> → </span>
              <StructureLink models={models} structureId={selected.outStructureId} />
              <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                same model — LLM emits strings, this step attaches source spans
              </span>
            </p>
          ) : (
            <StaticValue mono>
              <StructureLink models={models} structureId={selected.inStructureId} />
              <span className="text-muted-foreground"> → </span>
              <StructureLink models={models} structureId={selected.outStructureId} />
              <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                same model — LLM emits strings, this step attaches source spans
              </span>
            </StaticValue>
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
      {(invalidIssues ?? (invalid ? [invalid] : []))
        .filter((issue) => issue.kind !== "io-mismatch" && issue.kind !== "cardinality-mismatch")
        .map((issue, i) => (
          <p key={i} className="mb-3 font-mono text-[10px] leading-relaxed text-destructive">
            {invalidStepMessage(issue, models, modules)}
          </p>
        ))}
      {selected.kind !== "input" && warnings?.length ? (
        <div className="mb-3 space-y-1">
          {warningStepMessages(warnings, models, modules).map((msg, i) => (
            <p key={i} className={cn("font-mono text-[10px] leading-relaxed", WARNING_TEXT_CLASS)}>
              {msg}
            </p>
          ))}
        </div>
      ) : null}

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

      {selected.kind === "doc-to-text" && docToTextOcrAvailable && (
        <>
          <PipelineField
            label="Conversion"
            hint={edit ? "Use OCR for scanned PDFs and handwriting (OpenRouter vision)" : undefined}
          >
            {edit ? (
              <div className="flex flex-wrap gap-1.5">
                {DOC_PARSE_MODES.map((mode) => {
                  const active = docParseModeForModule(selected) === mode.value
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() =>
                        onUpdate!({
                          docParseMode: mode.value === "parser" ? undefined : mode.value,
                          model: mode.value === "llm" ? selected.model ?? "gemini-3-flash" : undefined,
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
            ) : (
              <StaticValue>
                {DOC_PARSE_MODES.find((m) => m.value === docParseModeForModule(selected))?.label ??
                  "Built-in parser"}
              </StaticValue>
            )}
          </PipelineField>
          {docParseModeForModule(selected) === "llm" && onUpdate && (
            <OcrExtraFields selected={selected} edit={!!edit} onUpdate={onUpdate} />
          )}
        </>
      )}

      {selected.kind === "input" && (
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
              label="Vision OCR"
              hint={edit ? "Separate from built-in parser (docs.content) — cached in doc_vision_cache" : undefined}
            >
              {edit ? (
                <div className="space-y-3 rounded-md border border-dashed border-chart-3/40 bg-chart-3/5 p-3">
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Built-in parser runs at upload (PDF.js → docs.content). Vision OCR runs via OpenRouter and is cached separately.
                  </p>
                  <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-medium">Enable vision OCR</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {selected.useOcr
                          ? "OpenRouter vision — cached per doc + model + prompt"
                          : "use built-in parser text only"}
                      </p>
                    </div>
                    <Switch
                      checked={!!selected.useOcr}
                      onCheckedChange={(v) =>
                        onUpdate!({
                          useOcr: v || undefined,
                          model: v ? selected.model ?? "gemini-3-flash" : undefined,
                          prompt: v ? selected.prompt : undefined,
                        })
                      }
                    />
                  </div>
                  {selected.useOcr && onUpdate && (
                    <OcrExtraFields selected={selected} edit={!!edit} onUpdate={onUpdate} />
                  )}
                </div>
              ) : (
                <StaticValue>{selected.useOcr ? "Vision OCR on" : "Built-in parser only"}</StaticValue>
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
      )}

      {selected.kind !== "input" && (
        <PipelineField
          label={selected.kind === "output" || selected.kind === "assert" ? "Structure to materialize" : "Input model"}
          hint={
            selected.kind === "output" && invalid?.kind === "no-output"
              ? "required — pick the structure this step snapshots"
              : selected.kind === "assert" && invalid?.kind === "no-output"
                ? "required — passthrough structure (matches upstream)"
                : undefined
          }
          hintTone={selected.kind === "output" || selected.kind === "assert" ? (invalid?.kind === "no-output" ? "error" : "warning") : "warning"}
        >
          {edit ? (
            <StructureModelSelect
              models={models}
              value={selected.inStructureId}
              onValueChange={(v) => onUpdate!({ inStructureId: v })}
              invalid={(selected.kind === "output" || selected.kind === "assert") && invalid?.kind === "no-output"}
            />
          ) : (
            <StaticValue mono>
              <StructureLink models={models} structureId={selected.inStructureId} />
            </StaticValue>
          )}
          <IoMismatchFieldFix
            fix={
              ioMismatchFix &&
              (ioMismatchFix.kind === "adopt-upstream" ||
                (selected.kind === "output" && ioMismatchFix.kind === "align-upstream"))
                ? ioMismatchFix
                : undefined
            }
            edit={!!edit}
            onFix={onFixIoMismatch}
          />
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
      )}

      {(selected.kind === "custom-code" || selected.kind === "assert") && (
        <PipelineField
          label={selected.kind === "assert" ? "Assert · step[\"Label\"] + len()" : "Code list · tried in order (first is primary)"}
          hint={
            selected.kind === "assert"
              ? "auto-placed after the latest referenced step label — passthrough on success"
              : undefined
          }
        >
          {edit ? (
            <div className="space-y-2">
              {(selected.fallbackList ?? []).map((fb, i) => {
                const lang = languageOfEntry(fb)
                const code = codeOfEntry(fb)
                return (
                  <div key={i} className="space-y-1.5 rounded-md border border-border bg-secondary/20 p-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {i === 0 ? "primary" : `fallback ${i}`}
                      </span>
                      <Select
                        value={lang}
                        onValueChange={(v) => {
                          const next = [...(selected.fallbackList ?? [])]
                          next[i] = makeCustomCodeEntry(v as CustomCodeLanguage, code)
                          onUpdate!({ fallbackList: next })
                        }}
                      >
                        <SelectTrigger className="h-8 w-36 bg-[oklch(0.14_0.004_264)] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="typescript">TypeScript</SelectItem>
                          <SelectItem value="python">Python</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-8 w-8 text-muted-foreground"
                        disabled={(selected.fallbackList?.length ?? 0) <= 1}
                        onClick={() => {
                          const next = (selected.fallbackList ?? []).filter((_, j) => j !== i)
                          onUpdate!({ fallbackList: next })
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {lang === "python"
                        ? selected.kind === "assert"
                          ? "def transform(input, state=None) — len/step helpers injected"
                          : "def transform(input, state=None)"
                        : selected.kind === "assert"
                          ? "(input, state) => void — step/len helpers injected"
                          : "(input, state) => output"}
                    </p>
                    <CustomCodeEditor
                      value={code}
                      language={lang}
                      label={i === 0 ? "primary" : `fallback ${i}`}
                      onChange={(nextCode) => {
                        const next = [...(selected.fallbackList ?? [])]
                        next[i] = makeCustomCodeEntry(lang, nextCode)
                        onUpdate!({ fallbackList: next })
                      }}
                    />
                  </div>
                )
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  onUpdate!({
                    fallbackList: [...(selected.fallbackList ?? []), makeCustomCodeEntry("typescript", "")],
                  })
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add fallback
              </Button>
            </div>
          ) : (selected.fallbackList?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {selected.fallbackList!.map((fb, i) => (
                <div key={i} className="rounded-md border border-border bg-secondary/20 p-2">
                  <p className="mb-1 font-mono text-[10px] text-muted-foreground">
                    {i === 0 ? "primary" : `fallback ${i}`} · {languageOfEntry(fb)}
                  </p>
                  <CustomCodeEditor
                    value={codeOfEntry(fb)}
                    language={languageOfEntry(fb)}
                    readOnly
                  />
                </div>
              ))}
            </div>
          ) : (
            <StaticValue>None</StaticValue>
          )}
        </PipelineField>
      )}
    </>
  )
}
