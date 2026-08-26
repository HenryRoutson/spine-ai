"use client"

// AI : TODO (spec) — outputDescription + checkOutputDescription: cheap LLM rejects step output that mismatches declared shape.
import { useMemo, useState } from "react"
import { WARNING_TEXT_CLASS } from "@/lib/ui-classes"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { AUTO_QUOTE_EXPLAINER, isAutoQuoteStep } from "@/lib/quote-steps"
import { AUTO_DOC_TO_TEXT_EXPLAINER, AUTO_STRUCTURE_PARSE_EXPLAINER, isAutoDocToTextStep, isAutoStructureParseStep } from "@/lib/structure-parse-steps"
import { inputModuleNeedsOcr, upstreamInputModule } from "@/lib/inference-input"
import { isExampleSelectKind } from "@/lib/example-select"
import { isLlmKind, isMergeModuleKind, usesPassthroughStructure } from "@/lib/module-kinds"
import { flattenPipelineModules, forkJoinOf, forkJoinScopeModules, locatePipelineModule } from "@/lib/fork-pipeline"
import { formatModuleSpineIn, formatModuleSpineOut } from "@/lib/spine-type"
import { MODULE_META, ModuleKind, DOC_PARSE_MODES, docParseModeForModule, type PipelineModule, type StructureModel, type TypeAlias } from "@/lib/types"
import {
  InvalidKind,
  IoMismatchFixKind,
  PipelineWarningKind,
  invalidStepMessage,
  warningStepMessages,
  type InvalidStep,
  type IoMismatchInspectorFix,
  type PipelineWarning,
} from "@/lib/validity"
import { StructureLink } from "@/components/structure-link"
import { cn } from "@/lib/utils"
import {
  LOGGING_SETTINGS_CHANGED_EVENT,
  readRequireInputDescriptions,
} from "@/lib/logging-settings"
import { useBrowserPrefEvent } from "@/lib/use-browser-pref-event"
import {
  PipelineField,
  StaticValue,
  StructureModelSelect,
  IoMismatchFieldFix,
  OcrExtraFields,
  useLlmSchemaPreview,
} from "@/components/pipeline-fields/shared"
import { InputModuleFields } from "@/components/pipeline-fields/input-fields"
import { LlmModuleFields } from "@/components/pipeline-fields/llm-fields"
import { CodeModuleFields } from "@/components/pipeline-fields/code-fields"
import { ListOpsModuleFields } from "@/components/pipeline-fields/list-ops-fields"
import { AssembleModuleFields } from "@/components/pipeline-fields/assemble-fields"
import { ParallelModuleFields } from "@/components/pipeline-fields/parallel-fields"
import { ForkModuleFields } from "@/components/pipeline-fields/fork-fields"
import { IfElseModuleFields } from "@/components/pipeline-fields/if-else-fields"
import { ExampleSelectModuleFields } from "@/components/pipeline-fields/example-select-fields"
import { WebhookModuleFields } from "@/components/pipeline-fields/webhook-fields"
import { N8nModuleFields } from "@/components/pipeline-fields/n8n-fields"
import { ConnectModuleFields } from "@/components/pipeline-fields/connect-fields"
import { ChatbotModuleFields } from "@/components/pipeline-fields/chatbot-fields"
import { InspectorCollapsibleSection } from "@/components/inspector-collapsible-section"

export { useLlmSchemaPreview } from "@/components/pipeline-fields/shared"

type PipelineModuleFieldsProps = {
  module: PipelineModule
  models: StructureModel[]
  typeAliases?: TypeAlias[]
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
  typeAliases = [],
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
  const priorLabels = useMemo(() => {
    if (selected.kind === ModuleKind.Fork) {
      const loc = locatePipelineModule(modules, selected.id)
      if (loc) {
        return forkJoinScopeModules(selected, loc)
          .modules.filter((m) => m.id !== selected.id)
          .map((m) => m.label.trim())
          .filter(Boolean)
      }
    }
    const flat = flattenPipelineModules(modules)
    const idx = flat.findIndex((m) => m.id === selected.id)
    if (idx <= 0) return []
    return flat.slice(0, idx).map((m) => m.label.trim()).filter(Boolean)
  }, [modules, selected])
  const llmSchemaPreview = useLlmSchemaPreview(selected, models, typeAliases)
  const edit = mode === "edit" && onUpdate
  const requireInputDescriptions = useBrowserPrefEvent(LOGGING_SETTINGS_CHANGED_EVENT, readRequireInputDescriptions)
  const hasNoPromptWarning = warnings?.some((w) => w.kind === PipelineWarningKind.NoPrompt)

  if (isAutoQuoteStep(selected)) {
    return (
      <div className="space-y-3">
        <InspectorCollapsibleSection title="Overview">
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">{AUTO_QUOTE_EXPLAINER}</p>
        </InspectorCollapsibleSection>
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
      </div>
    )
  }

  if (isAutoDocToTextStep(selected)) {
    const sourceInput = upstreamInputModule(selected, modules)
    const ocrOk = sourceInput ? inputModuleNeedsOcr(sourceInput) : true
    return (
      <div className="space-y-3">
        <InspectorCollapsibleSection title="Overview">
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            {AUTO_DOC_TO_TEXT_EXPLAINER}
          </p>
        </InspectorCollapsibleSection>
        <PipelineField label="Structure">
          <StaticValue mono>
            <StructureLink models={models} structureId={selected.inStructureId} />
            <span className="text-muted-foreground"> → </span>
            <StructureLink models={models} structureId={selected.outStructureId} />
            <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
              content None → instantiated text · cached per document
            </span>
          </StaticValue>
        </PipelineField>
        {ocrOk && (
          <PipelineField
            label="Conversion"
            hint={edit ? "Built-in parser, or DeepSeek / vision OCR for scans. Original bytes stay in storage — not on the spine." : undefined}
          >
            {edit ? (
              <div className="space-y-3 rounded-md border border-dashed border-chart-3/40 bg-chart-3/5 p-3">
                <div className="flex flex-wrap gap-1.5">
                  {DOC_PARSE_MODES.map((mode) => {
                    const active = docParseModeForModule(selected) === mode.value
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() =>
                          onUpdate({
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
                {docParseModeForModule(selected) === "llm" && (
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
      </div>
    )
  }

  if (isAutoStructureParseStep(selected)) {
    return (
      <div className="space-y-3">
        <InspectorCollapsibleSection title="Overview">
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            {AUTO_STRUCTURE_PARSE_EXPLAINER}
          </p>
        </InspectorCollapsibleSection>
        <PipelineField label="Structure">
          <StaticValue mono>
            <StructureLink models={models} structureId={selected.inStructureId} />
            <span className="text-muted-foreground"> → </span>
            <StructureLink models={models} structureId={selected.outStructureId} />
          </StaticValue>
        </PipelineField>
        <LlmModuleFields
          selected={selected}
          models={models}
          edit={false}
          globalModel={globalModel}
          hasNoPromptWarning={!!hasNoPromptWarning}
          llmSchemaPreview={llmSchemaPreview}
        />
      </div>
    )
  }

  const invalidMessages = (invalidIssues ?? (invalid ? [invalid] : []))
    .filter((issue) => issue.kind !== "io-mismatch" && issue.kind !== "cardinality-mismatch")
    .map((issue, i) => (
      <p key={i} className="font-mono text-[10px] leading-relaxed text-destructive">
        {invalidStepMessage(issue, models, modules)}
      </p>
    ))
  const warningMessages =
    selected.kind !== "input" && warnings?.length
      ? warningStepMessages(warnings, models, modules).map((msg, i) => (
          <p key={i} className={cn("font-mono text-[10px] leading-relaxed", WARNING_TEXT_CLASS)}>
            {msg}
          </p>
        ))
      : []
  const hasOverview =
    Boolean(MODULE_META[selected.kind].description) ||
    invalidMessages.length > 0 ||
    warningMessages.length > 0

  return (
    <div className="space-y-3">
      {hasOverview ? (
        <InspectorCollapsibleSection title="Overview">
          <div className="space-y-2">
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              {MODULE_META[selected.kind].description}
            </p>
            {invalidMessages}
            {warningMessages.length > 0 ? <div className="space-y-1">{warningMessages}</div> : null}
          </div>
        </InspectorCollapsibleSection>
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

      <PipelineField
        label="Input description"
        hint={
          edit
            ? requireInputDescriptions
              ? "required — describe what data this step expects"
              : "optional — an LLM check can reject step input that doesn't match before processing"
            : undefined
        }
      >
        {edit ? (
          <Textarea
            value={selected.inputDescription ?? ""}
            onChange={(e) =>
              onUpdate!({ inputDescription: e.target.value === "" ? undefined : e.target.value })
            }
            onBlur={(e) => {
              const trimmed = e.target.value.trim()
              const current = selected.inputDescription ?? ""
              if (trimmed !== current) onUpdate!({ inputDescription: trimmed || undefined })
            }}
            placeholder='e.g. "A signed W-2 wage statement for tax year 2024"'
            className="min-h-[72px] font-mono text-xs"
          />
        ) : selected.inputDescription?.trim() ? (
          <StaticValue>{selected.inputDescription}</StaticValue>
        ) : null}
      </PipelineField>

      {edit && selected.inputDescription?.trim() ? (
        <PipelineField
          label="Validate input"
          hint="LLM input check before this step runs — billed to your account"
        >
          <div className="flex items-center gap-2.5">
            <Switch
              checked={selected.checkInputDescription !== false}
              onCheckedChange={(checked) =>
                onUpdate!({ checkInputDescription: checked ? undefined : false })
              }
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              {selected.checkInputDescription !== false
                ? "On — rejects mismatched input before processing"
                : "Off — description stored only, no LLM check"}
            </span>
          </div>
        </PipelineField>
      ) : !edit && selected.inputDescription?.trim() ? (
        <PipelineField label="Validate input">
          <StaticValue>
            {selected.checkInputDescription !== false ? "On" : "Off"}
          </StaticValue>
        </PipelineField>
      ) : null}

      {(selected.kind === ModuleKind.Input ||
        selected.kind === ModuleKind.Combine ||
        selected.kind === ModuleKind.Assemble ||
        selected.kind === ModuleKind.Parallel ||
        selected.kind === ModuleKind.Fork ||
        selected.kind === ModuleKind.IfElse ||
        isLlmKind(selected.kind)) && (
        <PipelineField
          label="Annotation / purpose"
          hint={edit ? "required — describe what this step does or handles" : undefined}
          hintTone={
            edit && (invalidIssues ?? (invalid ? [invalid] : [])).some((issue) => issue.kind === InvalidKind.MissingNote)
              ? "error"
              : undefined
          }
        >
          {edit ? (
            <Input
              value={selected.note}
              onChange={(e) => onUpdate!({ note: e.target.value })}
              onBlur={(e) => {
                const trimmed = e.target.value.trim()
                if (trimmed !== selected.note) onUpdate!({ note: trimmed })
              }}
              placeholder="describe what this step does…"
              className="h-8 text-xs"
            />
          ) : selected.note.trim() ? (
            <StaticValue>{selected.note}</StaticValue>
          ) : null}
        </PipelineField>
      )}

      {selected.kind === ModuleKind.Input && (
        <InputModuleFields
          selected={selected}
          models={models}
          modules={modules}
          edit={!!edit}
          invalid={invalid}
          warnings={warnings}
          ioMismatchFix={ioMismatchFix}
          onUpdate={onUpdate}
          onFixIoMismatch={onFixIoMismatch}
        />
      )}

      {selected.kind !== ModuleKind.Input && selected.kind !== ModuleKind.Chatbot && selected.kind !== ModuleKind.Fork && selected.kind !== ModuleKind.IfElse && (
        <PipelineField
          label={usesPassthroughStructure(selected.kind) ? "Structure to materialize" : "Input model"}
          hint={
            selected.kind === ModuleKind.Output && invalid?.kind === InvalidKind.NoOutput
              ? "required — pick the structure this step snapshots"
              : selected.kind === ModuleKind.Assert && invalid?.kind === InvalidKind.NoOutput
                ? "required — passthrough structure (matches upstream)"
                : selected.kind === ModuleKind.HumanReview && invalid?.kind === InvalidKind.NoOutput
                  ? "required — data shape shown for review (matches upstream)"
                  : selected.kind === ModuleKind.HumanReview
                    ? "pipeline pauses in Inference — approve to continue or reject to stop"
                    : undefined
          }
          hintTone={usesPassthroughStructure(selected.kind) ? (invalid?.kind === InvalidKind.NoOutput ? "error" : "warning") : "warning"}
        >
          {edit ? (
            <StructureModelSelect
              models={models}
              value={selected.inStructureId}
              onValueChange={(v) => onUpdate!({ inStructureId: v })}
              invalid={usesPassthroughStructure(selected.kind) && invalid?.kind === InvalidKind.NoOutput}
            />
          ) : (
            <StaticValue mono>
              <StructureLink models={models} structureId={selected.inStructureId} />
            </StaticValue>
          )}
          <IoMismatchFieldFix
            fix={
              ioMismatchFix &&
              (ioMismatchFix.kind === IoMismatchFixKind.AdoptUpstream ||
                (selected.kind === ModuleKind.Output && ioMismatchFix.kind === IoMismatchFixKind.AlignUpstream))
                ? ioMismatchFix
                : undefined
            }
            edit={!!edit}
            onFix={onFixIoMismatch}
          />
        </PipelineField>
      )}

      {selected.kind !== ModuleKind.Input &&
        selected.kind !== ModuleKind.Output &&
        selected.kind !== ModuleKind.HumanReview &&
        selected.kind !== ModuleKind.Chatbot &&
        selected.kind !== ModuleKind.Assemble &&
        selected.kind !== ModuleKind.Parallel &&
        selected.kind !== ModuleKind.Fork && (
        <PipelineField
          label="Output model"
          hint={invalid?.kind === InvalidKind.NoOutput ? "required — step must emit a structure" : undefined}
          hintTone={invalid?.kind === InvalidKind.NoOutput ? "error" : "warning"}
        >
          {edit ? (
            <StructureModelSelect
              models={models}
              value={selected.outStructureId}
              onValueChange={(v) => onUpdate!({ outStructureId: v })}
              invalid={invalid?.kind === InvalidKind.NoOutput}
            />
          ) : (
            <StaticValue mono>
              <StructureLink models={models} structureId={selected.outStructureId} />
            </StaticValue>
          )}
          <IoMismatchFieldFix
            fix={ioMismatchFix?.kind === IoMismatchFixKind.AlignUpstream ? ioMismatchFix : undefined}
            edit={!!edit}
            onFix={onFixIoMismatch}
          />
        </PipelineField>
      )}

      {selected.kind === ModuleKind.Assemble && (
        <AssembleModuleFields
          selected={selected}
          models={models}
          modules={modules}
          priorLabels={priorLabels}
          edit={!!edit}
          onUpdate={onUpdate}
        />
      )}

      {selected.kind === ModuleKind.Fork && (
        <ForkModuleFields selected={selected} edit={!!edit} onUpdate={onUpdate} />
      )}

      {selected.kind === ModuleKind.IfElse && (
        <IfElseModuleFields selected={selected} edit={!!edit} onUpdate={onUpdate} />
      )}

      {selected.kind === ModuleKind.Fork && forkJoinOf(selected) === "assemble" && (
        <AssembleModuleFields
          selected={selected}
          models={models}
          modules={modules}
          priorLabels={priorLabels}
          edit={!!edit}
          onUpdate={onUpdate}
        />
      )}

      {selected.kind === ModuleKind.Parallel && (
        <ParallelModuleFields
          selected={selected}
          models={models}
          edit={!!edit}
          globalModel={globalModel}
          onUpdate={onUpdate}
        />
      )}

      {selected.kind !== ModuleKind.Input && (
        <PipelineField label="Spine types">
          <StaticValue mono>
            {formatModuleSpineIn(selected, models)} → {formatModuleSpineOut(selected, models)}
          </StaticValue>
        </PipelineField>
      )}

      {isLlmKind(selected.kind) && !isExampleSelectKind(selected.kind) && (
        <LlmModuleFields
          selected={selected}
          models={models}
          edit={!!edit}
          globalModel={globalModel}
          hasNoPromptWarning={!!hasNoPromptWarning}
          llmSchemaPreview={llmSchemaPreview}
          onUpdate={onUpdate}
        />
      )}

      {isExampleSelectKind(selected.kind) && (
        <ExampleSelectModuleFields
          selected={selected}
          priorLabels={priorLabels}
          edit={!!edit}
          globalModel={globalModel}
          onUpdate={onUpdate}
        />
      )}

      {(selected.kind === ModuleKind.CustomCode || selected.kind === ModuleKind.Assert) && (
        <CodeModuleFields
          selected={selected}
          edit={!!edit}
          onUpdate={onUpdate}
        />
      )}

      {(selected.kind === ModuleKind.Chunk ||
        selected.kind === ModuleKind.Merge ||
        isMergeModuleKind(selected.kind) ||
        (selected.kind === ModuleKind.Fork && forkJoinOf(selected) === "merge")) && (
        <ListOpsModuleFields
          selected={selected}
          models={models}
          edit={!!edit}
          onUpdate={onUpdate}
        />
      )}

      {selected.kind === ModuleKind.Webhook && (
        <WebhookModuleFields selected={selected} edit={!!edit} invalid={invalid} onUpdate={onUpdate} />
      )}
      {selected.kind === ModuleKind.N8n && (
        <N8nModuleFields selected={selected} edit={!!edit} invalid={invalid} onUpdate={onUpdate} />
      )}
      {selected.kind === ModuleKind.Connect && (
        <ConnectModuleFields selected={selected} edit={!!edit} invalid={invalid} onUpdate={onUpdate} />
      )}
      {/* AI : TODO (media-view-B-ui) — View picker on output (and any previewable step). TODO (media-view-C-picker) — custom visualizer. */}
      {/* AI : DONE (media-view-D-job) — poll/ingest live on webhook-fields, not a RemoteJob form. */}
      {selected.kind === ModuleKind.Chatbot && (
        <ChatbotModuleFields
          selected={selected}
          edit={!!edit}
          globalModel={globalModel}
          onUpdate={onUpdate}
        />
      )}
    </div>
  )
}
