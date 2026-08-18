// AI : Shared validity types and pure query helpers — imported by validity.ts, validity-messages.ts, validity-inspect.ts.
import type { ModuleId, PipelineModule, StructureModel, StructureModelId } from "./types";
import { locatePipelineModule } from "@/lib/fork-pipeline";

export enum InvalidKind {
  IoMismatch = "io-mismatch",
  CardinalityMismatch = "cardinality-mismatch",
  NoOutput = "no-output",
  TransformListWrap = "transform-list-wrap",
  EmptyLabel = "empty-label",
  DuplicateLabel = "duplicate-label",
  UnusedOutput = "unused-output",
  DuplicateInputStruct = "duplicate-input-struct",
  DuplicateOutputStruct = "duplicate-output-struct",
  StateKeyMissing = "state-key-missing",
  MissingInputDescription = "missing-input-description",
  MissingNote = "missing-note",
  MissingStructure = "missing-structure",
  CodeCompileError = "code-compile-error",
  JsonInputMismatch = "json-input-mismatch",
  StructureField = "structure-field",
  MissingCombineBeforeInput = "missing-combine-before-input",
  MissingWebhookUrl = "missing-webhook-url",
}

export interface InvalidStep {
  moduleId: ModuleId;
  kind: InvalidKind;
  expects?: StructureModelId;
  upstreamEmits?: StructureModelId;
  expectsType?: string;
  upstreamType?: string;
  missingLabel?: string;
  compileError?: string;
  structureMessage?: string;
}

export type InvalidMap = Map<ModuleId, InvalidStep[]>;

export enum PipelineWarningKind {
  NoPrompt = "no-prompt",
  QuoteNoFields = "quote-no-fields",
  TransformMultiList = "transform-multi-list",
  JsonInputType = "json-input-type",
  PromptQuoteMismatch = "prompt-quote-mismatch",
  UnusedModel = "unused-model",
  PromptListVsItem = "prompt-list-vs-item",
}

export interface PipelineWarning {
  moduleId: ModuleId;
  kind: PipelineWarningKind;
  detail?: string;
}

export enum IoMismatchFixKind {
  AdoptUpstream = "adopt-upstream",
  AlignUpstream = "align-upstream",
}

export interface IoMismatchFixHint {
  kind: IoMismatchFixKind;
  label: string;
}

export interface IoMismatchInspectorFix {
  mismatchModuleId: ModuleId;
  kind: IoMismatchFixKind;
  label: string;
  message: string;
}

export function invalidForModule(invalid: InvalidMap, moduleId: ModuleId): InvalidStep | undefined {
  return invalid.get(moduleId)?.[0];
}

export function invalidIssuesForModule(invalid: InvalidMap, moduleId: ModuleId): InvalidStep[] {
  return invalid.get(moduleId) ?? [];
}

export function modelName(models: StructureModel[], id?: StructureModelId): string | undefined {
  return models.find((m) => m.id === id)?.name;
}

export function prevModuleId(modules: PipelineModule[], moduleId: ModuleId): ModuleId | undefined {
  return locatePipelineModule(modules, moduleId)?.predecessor?.id;
}
