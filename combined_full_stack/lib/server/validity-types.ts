// AI : Shared validity types and pure query helpers — imported by validity.ts, validity-messages.ts, validity-inspect.ts.
import type { ModuleId, PipelineModule, StructureModel, StructureModelId } from "./types";

export type InvalidKind =
  | "io-mismatch"
  | "cardinality-mismatch"
  | "no-output"
  | "transform-list-wrap"
  | "empty-label"
  | "duplicate-label"
  | "unused-output"
  | "duplicate-input-struct"
  | "duplicate-output-struct"
  | "state-key-missing"
  | "missing-input-description"
  | "missing-note"
  | "missing-structure"
  | "code-compile-error"
  | "json-input-mismatch";

export interface InvalidStep {
  moduleId: ModuleId;
  kind: InvalidKind;
  expects?: StructureModelId;
  upstreamEmits?: StructureModelId;
  expectsType?: string;
  upstreamType?: string;
  missingLabel?: string;
  compileError?: string;
}

export type InvalidMap = Map<ModuleId, InvalidStep[]>;

export interface PipelineWarning {
  moduleId: ModuleId;
  kind: "no-prompt" | "quote-no-fields" | "transform-multi-list" | "json-input-type";
}

export interface IoMismatchFixHint {
  kind: IoMismatchFixKind;
  label: string;
}

export type IoMismatchFixKind = "adopt-upstream" | "align-upstream";

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
  const i = modules.findIndex((m) => m.id === moduleId);
  return i > 0 ? modules[i - 1]!.id : undefined;
}
