"use client"

import { useState } from "react"
import { WARNING_TEXT_CLASS } from "@/lib/ui-classes"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { AUTO_QUOTE_EXPLAINER, isAutoQuoteStep } from "@/lib/quote-steps"
import { isLlmKind, usesPassthroughStructure } from "@/lib/module-kinds"
import { MODULE_META } from "@/lib/types"
import type {
  PipelineModule,
  StructureModel,
} from "@/lib/types"
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
  useLlmSchemaPreview,
} from "@/components/pipeline-fields/shared"
import { InputModuleFields } from "@/components/pipeline-fields/input-fields"
import { LlmModuleFields } from "@/components/pipeline-fields/llm-fields"
import { CodeModuleFields } from "@/components/pipeline-fields/code-fields"

export { useLlmSchemaPreview } from "@/components/pipeline-fields/shared"

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
  const requireInputDescriptions = useBrowserPrefEvent(LOGGING_SETTINGS_CHANGED_EVENT, readRequireInputDescriptions)
  const hasNoPromptWarning = warnings?.some((w) => w.kind === "no-prompt")

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

      {(selected.kind === "input" || selected.kind === "combine" || isLlmKind(selected.kind)) && (
        <PipelineField
          label="Annotation / purpose"
          hint={edit ? "required — describe what this step does or handles" : undefined}
          hintTone={
            edit && (invalidIssues ?? (invalid ? [invalid] : [])).some((issue) => issue.kind === "missing-note")
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

      {selected.kind === "input" && (
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

      {selected.kind !== "input" && (
        <PipelineField
          label={usesPassthroughStructure(selected.kind) ? "Structure to materialize" : "Input model"}
          hint={
            selected.kind === "output" && invalid?.kind === "no-output"
              ? "required — pick the structure this step snapshots"
              : selected.kind === "assert" && invalid?.kind === "no-output"
                ? "required — passthrough structure (matches upstream)"
                : selected.kind === "human-review" && invalid?.kind === "no-output"
                  ? "required — data shape shown for review (matches upstream)"
                  : selected.kind === "human-review"
                    ? "pipeline pauses in Inference — approve to continue or reject to stop"
                    : undefined
          }
          hintTone={usesPassthroughStructure(selected.kind) ? (invalid?.kind === "no-output" ? "error" : "warning") : "warning"}
        >
          {edit ? (
            <StructureModelSelect
              models={models}
              value={selected.inStructureId}
              onValueChange={(v) => onUpdate!({ inStructureId: v })}
              invalid={usesPassthroughStructure(selected.kind) && invalid?.kind === "no-output"}
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

      {selected.kind !== "input" && selected.kind !== "output" && selected.kind !== "human-review" && (
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

      {(selected.kind === "custom-code" || selected.kind === "assert") && (
        <CodeModuleFields
          selected={selected}
          edit={!!edit}
          onUpdate={onUpdate}
        />
      )}
    </>
  )
}
