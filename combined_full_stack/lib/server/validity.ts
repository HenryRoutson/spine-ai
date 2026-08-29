// AI : Pipeline I/O graph validation — core computation and pipeline utilities.
// AI : TODO (linter-first) — shrink computeInvalid: generate pipeline.py or pipeline.rs with typed step chain,
// AI :   run pyright / cargo check; surface diagnostics in UI instead of custom stepAcceptsSpineType rules.
// AI : Types + messages → validity-types.ts / validity-messages.ts / validity-inspect.ts.
// AI : TODO (arch-validity-split) — this file still mixes graph I/O, n8n, billedCents notes.
// AI :   Keep computeInvalid as the graph checker; n8n messages already split.
// AI : TODO (spec) — derive dependency graph from step() refs in custom code; flag unused/isolated steps (linear spine only today).
// AI : DONE (allow-pipeline-non-linear-fork) — computeInvalid walks Fork lanes with synthetic predecessor; join product is next spine.
// AI : TODO security — runs.data is user-writable via RLS; billedCents in JSON can be forged for display.
// AI : Split billing fields to server-only columns or restrict data updates with a trigger.
import type {
  ModuleId,
  PipelineModule,
  Project,
  StructureModel,
  StructureModelId,
  TypeAlias,
} from "./types";
import { ModuleKind, FieldType } from "./types";
import { getN8nNode, missingN8nParams } from "@/lib/n8n-catalog";
import { getConnectAction, missingConnectParams } from "@/lib/connect-catalog";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { tryCompileCustomCodeEntry } from "@/lib/custom_code";
import { usesPassthroughStructure, isLlmKind, isMergeModuleKind, stepRequiresNote } from "@/lib/module-kinds";
import { inputModuleTypesAreAllJsonNative, inputTypeLabel, inputTypesForModule } from "@/lib/inference-input-core";
import { assertEntriesForModule, parseAssertReferencedLabels } from "@/lib/assert_steps";
import {
  canAutoWrapListIntoOutputStructure,
  hasQuoteField,
  listFieldsForWrap,
  listFieldForAutoUnwrap,
  isBuiltinDocumentModel,
} from "./structure";
import { isLockedStructureModel, withSharedModels } from "./builtin_models";
import { parseSqlSelect } from "@/lib/sql-schema";
import {
  cardinalityMismatch,
  collectTypeExprRefModelIds,
  fieldToTypeExpr,
  formatTypeExpr,
  stepSpineInType,
  stepSpineOutType,
  typeExprEqual,
  typeExprItemRef,
  TypeExprKind,
  type TypeExpr,
} from "./type_expr";
import { typeExprAssignable, validateAssembleBindings } from "@/lib/assemble-type-expr";
import {
  FORK_MAX_BRANCHES,
  FORK_MIN_BRANCHES,
  flattenPipelineModules,
  forkBranchesOf,
  forkJoinOf,
  forkProductField,
  isForkKind,
  isIfElseKind,
  isCaseKind,
  isControlJoinKind,
  isExclusiveKind,
  isNestedLaneKind,
  locatePipelineModule,
  validateForkAssembleJoin,
} from "@/lib/fork-pipeline";
import { ifThenBranch } from "@/lib/if-else-pipeline";
import { isDefaultCaseMatch } from "@/lib/case-pipeline";
import { ifConditionTypeError } from "@/lib/if-condition";
import { pipelineDagIsAcyclic, pipelineToDag } from "@/lib/pipeline-dag";
import { typeExprAtPath } from "@/lib/type-expr-polymorph";
import { exampleSelectAcceptsWrapper, isExampleSelectKind } from "@/lib/example-select";
import {
  stepEmits,
  stepEmitsList,
  inputFeedsCombine,
  inputFeedsAssemble,
  isCombineSideParseStep,
  isAutoQuoteStep,
  isManagedLockedStep,
  skipDuplicateLabelCheck,
  AUTO_QUOTE_EXPLAINER,
  AUTO_STRUCTURE_PARSE_EXPLAINER,
  AUTO_DOC_TO_TEXT_EXPLAINER,
  projectWithAuthoredModules,
  syncAutoQuoteSteps,
  syncAutoStructureParseSteps,
  syncManagedPipelineSteps,
  syncAssertPlacement,
  migrateProjectModules,
} from "./validity-sync";
import {
  InvalidKind,
  PipelineWarningKind,
  type InvalidStep,
  type InvalidMap,
  type PipelineWarning,
  invalidForModule,
  invalidIssuesForModule,
  modelName,
} from "./validity-types";
import { invalidStepMessage, warningStepMessage, warningStepMessages } from "./validity-messages";
import {
  computeStructureIssues,
  modelFieldExprsUseAlias,
  structureIssueMessage,
} from "@/lib/structure-validity";
import {
  IoMismatchFixKind,
  type IoMismatchFixHint,
  type IoMismatchInspectorFix,
  ioMismatchFixHints,
  ioMismatchAtModuleIndex,
  ioMismatchUpstreamOf,
  stepIoMismatchLinked,
  ioMismatchInspectorFix,
  stepIoMismatchMessage,
  prevModuleId,
} from "./validity-inspect";

export { stepEmitsList } from "./type_expr";
export {
  stepEmits,
  isAutoQuoteStep,
  isAutoStructureParseStep,
  isAutoDocToTextStep,
  isManagedLockedStep,
  AUTO_QUOTE_EXPLAINER,
  AUTO_STRUCTURE_PARSE_EXPLAINER,
  AUTO_DOC_TO_TEXT_EXPLAINER,
  authoredPipelineModules,
  projectWithAuthoredModules,
  syncAutoQuoteSteps,
  syncAutoStructureParseSteps,
  syncManagedPipelineSteps,
  syncAssertPlacement,
  migrateProjectModules,
} from "./validity-sync";
export { InvalidKind, PipelineWarningKind } from "./validity-types";
export type { InvalidStep, InvalidMap, PipelineWarning } from "./validity-types";
export {
  invalidForModule,
  invalidIssuesForModule,
  modelName,
  prevModuleId,
} from "./validity-types";
export { invalidStepMessage, warningStepMessage, warningStepMessages } from "./validity-messages";
export { IoMismatchFixKind } from "./validity-inspect";
export type { IoMismatchFixHint, IoMismatchInspectorFix } from "./validity-inspect";
export {
  ioMismatchFixHints,
  ioMismatchAtModuleIndex,
  ioMismatchUpstreamOf,
  stepIoMismatchLinked,
  ioMismatchInspectorFix,
  stepIoMismatchMessage,
} from "./validity-inspect";

function pushInvalid(invalid: InvalidMap, issue: InvalidStep): void {
  const list = invalid.get(issue.moduleId) ?? [];
  if (
    list.some(
      (x) =>
        x.kind === issue.kind &&
        x.expectsType === issue.expectsType &&
        x.missingLabel === issue.missingLabel &&
        x.structureMessage === issue.structureMessage,
    )
  ) {
    return;
  }
  list.push(issue);
  invalid.set(issue.moduleId, list);
}

function spineMismatchIssue(
  moduleId: ModuleId,
  expected: TypeExpr,
  actual: TypeExpr,
  models: StructureModel[],
): InvalidStep {
  const expectsType = formatTypeExpr(expected, models);
  const upstreamType = formatTypeExpr(actual, models);
  if (cardinalityMismatch(expected, actual)) {
    return {
      moduleId,
      kind: InvalidKind.CardinalityMismatch,
      expectsType,
      upstreamType,
      expects: expected.kind === "ref" ? expected.modelId : expected.kind === "list" && expected.item.kind === "ref" ? expected.item.modelId : undefined,
      upstreamEmits: actual.kind === "ref" ? actual.modelId : actual.kind === "list" && actual.item.kind === "ref" ? actual.item.modelId : undefined,
    };
  }
  return {
    moduleId,
    kind: InvalidKind.IoMismatch,
    expectsType,
    upstreamType,
    expects: expected.kind === "ref" ? expected.modelId : expected.kind === "list" && expected.item.kind === "ref" ? expected.item.modelId : undefined,
    upstreamEmits: actual.kind === "ref" ? actual.modelId : actual.kind === "list" && actual.item.kind === "ref" ? actual.item.modelId : undefined,
  };
}

function bareTransformCanAutoWrapList(
  m: PipelineModule,
  actual: TypeExpr,
  models: StructureModel[],
): boolean {
  // AI : TODO (linter-first) — encode auto-wrap as explicit generated transform signature, not TS heuristic.
  if (m.kind !== ModuleKind.Transform || m.code?.trim() || stepEmitsList(m)) return false;
  if (actual.kind !== "list" || actual.item.kind !== "ref") return false;
  const out = models.find((x) => x.id === m.outStructureId);
  if (!out) return false;
  return canAutoWrapListIntoOutputStructure(out, actual.item.modelId, m.inStructureId);
}

function stepAcceptsSpineType(
  m: PipelineModule,
  expected: TypeExpr,
  actual: TypeExpr,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): boolean {
  // AI : TODO (linter-first) — delete when spine compat is cargo/pyright on generated orchestrator only.
  if (typeExprAssignable(expected, actual, typeAliases, models) || typeExprEqual(expected, actual)) return true;
  // AI : assert steps read pipeline state by label — spine type at this index is not their contract.
  if (m.kind === ModuleKind.Assert) return true;
  // AI : output / human-review snapshot the spine value — item type must match; list vs single is inherited.
  if (m.kind === ModuleKind.Output || m.kind === ModuleKind.HumanReview) {
    const e = typeExprItemRef(expected);
    const a = typeExprItemRef(actual);
    return e != null && e === a;
  }
  // AI : example-select unwraps the sole list[T] field on a combine (or similar) wrapper struct.
  if (isExampleSelectKind(m.kind) && exampleSelectAcceptsWrapper(expected, actual, models)) return true;
  if (!cardinalityMismatch(expected, actual)) return false;
  // AI : custom-code / coded transform steps reshape list↔object at runtime — spine item type still matches.
  if (m.kind === ModuleKind.CustomCode || m.kind === ModuleKind.Chunk || isMergeModuleKind(m.kind) || (m.kind === ModuleKind.Transform && !!m.code?.trim())) return true;
  // AI : bare transform auto-wraps list[T] into { listField: T[] } when the output structure has a matching list field.
  if (bareTransformCanAutoWrapList(m, actual, models)) return true;
  return false;
}

function computeParallelInvalid(modules: PipelineModule[], models: StructureModel[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (const m of modules) {
    if (m.kind !== ModuleKind.Parallel) continue;
    const branches = m.parallelBranches ?? [];
    if (!branches.length) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: "add at least one parallel LLM branch",
      });
      continue;
    }
    const fields = new Set<string>();
    for (const b of branches) {
      if (!b.field.trim()) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: "each parallel branch needs a field name",
        });
      } else if (fields.has(b.field.trim())) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: `duplicate parallel field "${b.field.trim()}"`,
        });
      } else fields.add(b.field.trim());
      if (!b.outStructureId || !models.some((x) => x.id === b.outStructureId)) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: `branch "${b.field || "?"}" needs an output structure`,
        });
      }
      if (!b.prompt.trim()) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: `branch "${b.field || "?"}" needs a prompt`,
        });
      }
    }
  }
  return invalid;
}

function computeAssembleInvalid(
  modules: PipelineModule[],
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    if (m.kind !== ModuleKind.Assemble) continue;
    const prev = i > 0 ? modules[i - 1] : undefined;
    for (const issue of validateAssembleBindings(m, prev, modules, i, models, typeAliases)) {
      if (issue.missingLabel) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StateKeyMissing,
          missingLabel: issue.missingLabel,
        });
      } else {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: issue.message,
        });
      }
    }
  }
  return invalid;
}

function moduleInputTypes(m: PipelineModule): string[] {
  if (!m.inputType) return [];
  return Array.isArray(m.inputType) ? m.inputType : [m.inputType];
}

// AI : static check for bare transform list→object auto-wrap (same rules as wrapListForOutputStructure).
export function transformListWrapInvalid(
  m: PipelineModule,
  prev: PipelineModule | undefined,
  models: StructureModel[],
): InvalidStep | undefined {
  if (m.kind !== ModuleKind.Transform || m.code?.trim() || stepEmitsList(m) || !stepEmitsList(prev)) return undefined;
  const out = models.find((x) => x.id === m.outStructureId);
  if (!out) return undefined;
  // AI : same in/out unwraps only when the upstream list has exactly one item — checked as a warning.
  if (m.inStructureId === m.outStructureId) return undefined;
  if (listFieldsForWrap(out).length > 0) return undefined;
  return { moduleId: m.id, kind: InvalidKind.TransformListWrap, expects: m.inStructureId, upstreamEmits: m.outStructureId };
}

function transformListFlattenInvalid(
  m: PipelineModule,
  prev: PipelineModule | undefined,
  models: StructureModel[],
): InvalidStep | undefined {
  if (m.kind !== ModuleKind.Transform || m.code?.trim() || !stepEmitsList(m) || !m.outStructureId) return undefined;
  if (stepEmitsList(prev)) {
    if (m.inStructureId === m.outStructureId) return undefined;
    return {
      moduleId: m.id,
      kind: InvalidKind.StructureField,
      structureMessage: `bare transform cannot map list → list[${models.find((x) => x.id === m.outStructureId)?.name ?? "item"}] — use custom-code`,
    };
  }
  const input = models.find((x) => x.id === m.inStructureId);
  if (!input) return undefined;
  if (listFieldForAutoUnwrap(input, m.outStructureId)) return undefined;
  const inName = input.name;
  const outName = models.find((x) => x.id === m.outStructureId)?.name ?? "item";
  return {
    moduleId: m.id,
    kind: InvalidKind.StructureField,
    structureMessage: `bare transform ${inName} → list[${outName}] needs a list[model] field on ${inName} (ref ${outName}), or custom-code`,
  };
}

function computeLabelInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  const byLabel = new Map<string, ModuleId[]>();
  for (const m of modules) {
    const label = m.label.trim();
    if (!label) {
      pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.EmptyLabel });
      continue;
    }
    if (skipDuplicateLabelCheck(m)) continue;
    const ids = byLabel.get(label) ?? [];
    ids.push(m.id);
    byLabel.set(label, ids);
  }
  for (const ids of byLabel.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) pushInvalid(invalid, { moduleId: id, kind: InvalidKind.DuplicateLabel });
  }
  return invalid;
}

function labelsInScope(modules: PipelineModule[], beforeIndex: number): Set<string> {
  const labels = new Set<string>();
  for (let i = 0; i < beforeIndex; i++) {
    const label = modules[i]!.label.trim();
    if (label) labels.add(label);
  }
  return labels;
}

function computeStateKeyInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    if (m.kind !== ModuleKind.Assert && m.kind !== ModuleKind.CustomCode && m.kind !== ModuleKind.Transform) continue;
    const entries =
      m.kind === ModuleKind.Assert
        ? assertEntriesForModule(m).map((e) => e.code)
        : customCodeEntriesForModule(m).map((e) => e.code);
    const code = entries.join("\n") || m.code || "";
    if (!code.trim()) continue;
    const scope = labelsInScope(modules, i);
    for (const label of parseAssertReferencedLabels(code)) {
      if (!scope.has(label)) {
        pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.StateKeyMissing, missingLabel: label });
      }
    }
  }
  return invalid;
}

function computeMissingStructureInvalid(
  modules: PipelineModule[],
  models: StructureModel[],
): InvalidMap {
  // AI : TODO bug — also flag dangling field.ref and empty field names.
  const invalid: InvalidMap = new Map();
  const modelIds = new Set(models.map((m) => m.id));
  for (const m of modules) {
    for (const sid of [m.inStructureId, m.outStructureId]) {
      if (sid && !modelIds.has(sid)) {
        pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.MissingStructure, expects: sid });
      }
    }
  }
  return invalid;
}

function computeLlmDocumentFieldInvalid(
  modules: PipelineModule[],
  models: StructureModel[],
): InvalidMap {
  const invalid: InvalidMap = new Map();
  const allModels = withSharedModels(models);
  for (const m of modules) {
    if (!isLlmKind(m.kind) || !m.outStructureId) continue;
    const model = allModels.find((x) => x.id === m.outStructureId);
    if (!model) continue;
    const docField = model.fields.find(
      (f) => f.type === FieldType.Document || f.type === FieldType.ListDocument,
    );
    if (!docField) continue;
    pushInvalid(invalid, {
      moduleId: m.id,
      kind: InvalidKind.StructureField,
      structureMessage: `${model.name}.${docField.name} is type document — llm/llm-batch cannot emit Document (filename lives on the input). Use combine for document fields.`,
    });
  }
  return invalid;
}

// AI : execCombineStep only writes the side file into a document field or a field whose ref
// AI : matches the previous step. Everything else gets pipeline state — silent type smash.
function combineFieldTakesSide(
  f: { type: FieldType; ref?: StructureModelId },
  prevEmitId: StructureModelId | undefined,
  inStructureId: StructureModelId | undefined,
): boolean {
  if (f.type === FieldType.Document || f.type === FieldType.ListDocument) return true;
  return !!prevEmitId && prevEmitId !== inStructureId && f.ref === prevEmitId;
}

function computeCombineOutputInvalid(
  modules: PipelineModule[],
  models: StructureModel[],
): InvalidMap {
  const invalid: InvalidMap = new Map();
  const allModels = withSharedModels(models);
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    if (m.kind !== ModuleKind.Combine || !m.outStructureId) continue;
    const out = allModels.find((x) => x.id === m.outStructureId);
    if (!out) continue;
    const prevEmit = stepEmits(i > 0 ? modules[i - 1] : undefined);
    if (out.fields.some((f) => combineFieldTakesSide(f, prevEmit, m.inStructureId))) continue;
    const prevName = prevEmit ? (modelName(allModels, prevEmit) ?? String(prevEmit)) : "the previous step";
    pushInvalid(invalid, {
      moduleId: m.id,
      kind: InvalidKind.StructureField,
      structureMessage: `combine output ${out.name} has no field for the side input — add a document field, or a field whose ref matches ${prevName}`,
    });
  }
  return invalid;
}

function computeJsonInputMismatchInvalid(
  modules: PipelineModule[],
  models: StructureModel[],
): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (const m of modules) {
    if (m.kind !== ModuleKind.Input || !inputModuleTypesAreAllJsonNative(m)) continue;
    const out = models.find((x) => x.id === m.outStructureId);
    if (isBuiltinDocumentModel(out)) {
      pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.JsonInputMismatch });
    }
  }
  return invalid;
}

function computeInputAssignedDocInvalid(
  modules: PipelineModule[],
  opts?: ComputeInvalidOpts,
): InvalidMap {
  const invalid: InvalidMap = new Map();
  const docs = opts?.inferenceDocs ?? [];
  if (!docs.length && !opts?.assignedDocTypes) return invalid;
  for (const m of modules) {
    if (m.kind !== ModuleKind.Input) continue;
    const allowed = inputTypesForModule(m);
    if (!allowed.length) continue;
    const allowedSet = new Set(allowed as string[]);
    const assigned = opts?.assignedDocTypes?.[m.id] ?? [];
    const wrongAssigned = assigned.filter((t) => !allowedSet.has(t));
    if (wrongAssigned.length) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: `assigned ${wrongAssigned.join(", ")} file does not match input type ${inputTypeLabel(m.inputType)}`,
      });
      continue;
    }
    if (!docs.length) continue;
    const passable = docs.filter((d) => allowedSet.has(d.type));
    if (!passable.length) {
      const seen = [...new Set(docs.map((d) => d.type))].join(", ");
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: `no uploaded inference docs match this input (${inputTypeLabel(m.inputType)}; have ${seen})`,
      });
    }
  }
  return invalid;
}

function computeCodeCompileInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (const m of modules) {
    const isCodeStep =
      m.kind === ModuleKind.CustomCode ||
      m.kind === ModuleKind.Chunk ||
      isMergeModuleKind(m.kind) ||
      m.kind === ModuleKind.Assert ||
      (m.kind === ModuleKind.Transform && !!m.code?.trim());
    if (!isCodeStep) continue;

    const entries =
      m.kind === ModuleKind.Assert
        ? assertEntriesForModule(m)
        : customCodeEntriesForModule(m);
    if (!entries.length) {
      if (m.kind === ModuleKind.CustomCode) {
        pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.CodeCompileError, compileError: "no code entries" });
      }
      continue;
    }
    for (const entry of entries) {
      const err = tryCompileCustomCodeEntry(entry, { assert: m.kind === ModuleKind.Assert });
      if (err) pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.CodeCompileError, compileError: err });
    }
    // AI : struct field examples validated via computeStructureIssues (invalid-field-example).
  }
  return invalid;
}

export type ComputeInvalidOpts = {
  requireInputDescriptions?: boolean;
  typeAliases?: TypeAlias[];
  inferenceDocs?: { name: string; type: string }[];
  assignedDocTypes?: Partial<Record<ModuleId, string[]>>;
  startPrev?: PipelineModule;
  // AI : Fork lanes — join consumes the last module of each lane (product/assemble/merge).
  laneJoinConsumesLast?: boolean;
};

function modulesForStructure(modelId: StructureModelId, modules: PipelineModule[]): ModuleId[] {
  if (!modelId) return [];
  const ids: ModuleId[] = [];
  for (const m of modules) {
    if (m.inStructureId === modelId || m.outStructureId === modelId) ids.push(m.id);
  }
  return ids;
}

function structureTreeContains(
  rootId: StructureModelId,
  targetId: StructureModelId,
  byId: Map<StructureModelId, StructureModel>,
): boolean {
  const seen = new Set<StructureModelId>();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.pop()!;
    if (id === targetId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const model = byId.get(id);
    if (!model) continue;
    for (const field of model.fields) {
      if (field.ref) queue.push(field.ref);
      for (const refId of collectTypeExprRefModelIds(fieldToTypeExpr(field))) queue.push(refId);
    }
  }
  return false;
}

function pipelineReachableModelIds(
  modules: PipelineModule[],
  models: StructureModel[],
): Set<StructureModelId> {
  const byId = new Map(models.map((m) => [m.id, m]));
  const seeds = new Set<StructureModelId>();
  for (const m of modules) {
    if (m.inStructureId) seeds.add(m.inStructureId);
    if (m.outStructureId) seeds.add(m.outStructureId);
    for (const b of m.parallelBranches ?? []) {
      if (b.outStructureId) seeds.add(b.outStructureId);
    }
  }
  const reachable = new Set<StructureModelId>(seeds);
  const queue = [...seeds];
  while (queue.length) {
    const id = queue.pop()!;
    const model = byId.get(id);
    if (!model) continue;
    for (const field of model.fields) {
      if (field.ref && !reachable.has(field.ref)) {
        reachable.add(field.ref);
        queue.push(field.ref);
      }
      for (const refId of collectTypeExprRefModelIds(fieldToTypeExpr(field))) {
        if (!reachable.has(refId)) {
          reachable.add(refId);
          queue.push(refId);
        }
      }
    }
  }
  return reachable;
}

function modulesAffectedByStructure(
  modelId: StructureModelId,
  modules: PipelineModule[],
  models: StructureModel[],
): ModuleId[] {
  const direct = modulesForStructure(modelId, modules);
  if (direct.length) return direct;
  const byId = new Map(models.map((m) => [m.id, m]));
  const affected: ModuleId[] = [];
  for (const m of modules) {
    for (const rootId of [m.inStructureId, m.outStructureId]) {
      if (!rootId) continue;
      if (rootId === modelId || structureTreeContains(rootId, modelId, byId)) {
        affected.push(m.id);
        break;
      }
    }
  }
  return affected;
}

function computeStructureFieldInvalid(
  modules: PipelineModule[],
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): InvalidMap {
  const invalid: InvalidMap = new Map();
  const allModels = withSharedModels(models);
  const reachable = pipelineReachableModelIds(modules, allModels);
  for (const issue of computeStructureIssues(models, typeAliases)) {
    if (issue.aliasName && !issue.fieldId) {
      // AI : orphan alias rows (empty name, duplicate, etc.) — Structures tab only.
      if (issue.kind !== "incomplete-type-expr") continue;
      // AI : field refs to incomplete aliases get their own issues; this covers unused aliases.
      if (modelFieldExprsUseAlias(models, issue.aliasName, reachable)) continue;
      const message = structureIssueMessage(issue, allModels);
      const anchor = modules[0];
      if (anchor) {
        pushInvalid(invalid, { moduleId: anchor.id, kind: InvalidKind.StructureField, structureMessage: message });
      }
      continue;
    }
    // AI : auto-inferred orphans (Structure N from doc upload) must not block runs on step 1.
    if (!reachable.has(issue.modelId)) continue;
    const message = structureIssueMessage(issue, allModels);
    const moduleIds = modulesAffectedByStructure(issue.modelId, modules, allModels);
    for (const moduleId of moduleIds) {
      pushInvalid(invalid, { moduleId, kind: InvalidKind.StructureField, structureMessage: message });
    }
  }
  return invalid;
}

function computeInputDescriptionInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (const m of modules) {
    if (isManagedLockedStep(m)) continue;
    if (m.inputDescription?.trim()) continue;
    pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.MissingInputDescription });
  }
  return invalid;
}

function computeExampleSelectInvalid(modules: PipelineModule[], models: StructureModel[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    if (!isExampleSelectKind(m.kind)) continue;
    const label = m.exampleContextLabel?.trim();
    if (!label) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: "context step label is required — prior step output fills {description}",
      });
      continue;
    }
    if (!labelsInScope(modules, i).has(label)) {
      pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.StateKeyMissing, missingLabel: label });
    }
    // AI : TODO (example-select-view) — when examplePromptFields ships, flag names not on inType item fields.
    // AI : TODO (type-join) — prompt view must be a Pick/join of the item type, not an arbitrary reshape.
    const inModel = models.find((x) => x.id === m.inStructureId);
    const fieldNames = new Set(inModel?.fields.map((f) => f.name) ?? []);
    const view = m.examplePromptView?.trim();
    if (view) {
      const parsed = parseSqlSelect(view);
      if (parsed.error || parsed.hasJoin) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: parsed.error ?? "prompt view in this slice is SELECT columns FROM table only (no JOIN)",
        });
      } else if (inModel) {
        for (const col of parsed.columns) {
          if (!fieldNames.has(col)) {
            pushInvalid(invalid, {
              moduleId: m.id,
              kind: InvalidKind.StructureField,
              structureMessage: `prompt view column "${col}" is not a field on ${inModel.name}`,
            });
          }
        }
      }
    } else if (m.examplePromptFields?.length && inModel) {
      for (const raw of m.examplePromptFields) {
        const col = raw.trim();
        if (!col) continue;
        if (!fieldNames.has(col)) {
          pushInvalid(invalid, {
            moduleId: m.id,
            kind: InvalidKind.StructureField,
            structureMessage: `prompt field "${col}" is not a field on ${inModel.name}`,
          });
        }
      }
    }
  }
  return invalid;
}

function computeMergeStateInvalid(modules: PipelineModule[], models: StructureModel[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    if (!isMergeModuleKind(m.kind)) continue;
    const label = m.mergeStateLabel?.trim();
    if (label && !labelsInScope(modules, i).has(label)) {
      pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.StateKeyMissing, missingLabel: label });
    }
    const wrap = m.mergeWrapListField?.trim();
    if (wrap && m.outStructureId) {
      const out = models.find((model) => model.id === m.outStructureId);
      if (!out?.fields.some((f) => f.name === wrap)) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: `mergeWrapListField "${wrap}" is not on output structure ${out?.name ?? m.outStructureId}`,
        });
      }
    }
  }
  return invalid;
}

function computeMissingCombineBeforeInputInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  let needsCombineForNextInput = false;

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    if (m.kind === ModuleKind.Input) {
      if (needsCombineForNextInput && !inputFeedsCombine(modules, i) && !inputFeedsAssemble(modules, i)) {
        pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.MissingCombineBeforeInput });
      }
      continue;
    }
    if (m.kind === ModuleKind.Combine || m.kind === ModuleKind.Assemble) {
      needsCombineForNextInput = false;
      continue;
    }
    if (m.kind === ModuleKind.Assert || m.kind === ModuleKind.HumanReview) continue;
    const hadInput = modules.slice(0, i).some((x) => x.kind === ModuleKind.Input);
    if (hadInput) needsCombineForNextInput = true;
  }

  return invalid;
}

function computeNoteInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (const m of modules) {
    if (!stepRequiresNote(m.kind)) continue;
    if (m.note.trim()) continue;
    pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.MissingNote });
  }
  return invalid;
}

function computeWebhookInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (const m of modules) {
    if (m.kind !== ModuleKind.Webhook) continue;
    if (m.webhookUrl?.trim()) continue;
    pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.MissingWebhookUrl });
  }
  return invalid;
}

function computeN8nInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (const m of flattenPipelineModules(modules)) {
    if (m.kind !== ModuleKind.N8n) continue;
    const type = m.n8nNodeType?.trim();
    if (!type) {
      pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.MissingN8nNodeType });
      continue;
    }
    const entry = getN8nNode(type);
    if (!entry) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: `unknown transform piece "${type}" — use list_pieces`,
      });
      continue;
    }
    const missing = missingN8nParams(entry, m.n8nParameters);
    if (missing.length) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: `${entry.displayName} needs: ${missing.join(", ")}`,
      });
    }
  }
  return invalid;
}

function computeConnectInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (const m of flattenPipelineModules(modules)) {
    if (m.kind !== ModuleKind.Connect) continue;
    const id = m.connectActionId?.trim();
    if (!id) {
      pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.MissingConnectAction });
      continue;
    }
    const entry = getConnectAction(id);
    if (!entry) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: `unknown connect action "${id}" — use list_connect_actions`,
      });
      continue;
    }
    const missing = missingConnectParams(entry, m.connectParameters);
    if (missing.length) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: `${entry.displayName} needs: ${missing.join(", ")}`,
      });
    }
  }
  return invalid;
}

function computeForkInvalid(
  modules: PipelineModule[],
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (const m of flattenPipelineModules(modules)) {
    if (!isForkKind(m.kind)) continue;
    const branches = forkBranchesOf(m);
    if (branches.length < FORK_MIN_BRANCHES) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: `fork needs at least ${FORK_MIN_BRANCHES} lanes`,
      });
    }
    if (branches.length > FORK_MAX_BRANCHES) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: `fork is capped at ${FORK_MAX_BRANCHES} lanes`,
      });
    }
    const fields = new Set<string>();
    const labels = new Set<string>();
    for (const b of branches) {
      const label = b.label.trim();
      if (!label) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: "each fork lane needs a label",
        });
      } else if (labels.has(label)) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: `duplicate fork lane "${label}"`,
        });
      } else labels.add(label);
      const field = forkProductField(b);
      if (fields.has(field)) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: `duplicate fork product field "${field}"`,
        });
      } else fields.add(field);
      if (!b.modules.length) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: `lane "${label || b.id}" is empty — add at least one step`,
        });
      }
    }
    const join = forkJoinOf(m);
    if (join === "assemble") {
      const loc = locatePipelineModule(modules, m.id);
      if (loc) {
        for (const issue of validateForkAssembleJoin(m, loc, models, typeAliases)) {
          if (issue.missingLabel) {
            pushInvalid(invalid, {
              moduleId: m.id,
              kind: InvalidKind.StateKeyMissing,
              missingLabel: issue.missingLabel,
            });
          } else {
            pushInvalid(invalid, {
              moduleId: m.id,
              kind: InvalidKind.StructureField,
              structureMessage: issue.message,
            });
          }
        }
      }
    }
  }
  return invalid;
}

function computeIfElseInvalid(
  modules: PipelineModule[],
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (const m of flattenPipelineModules(modules)) {
    if (!isIfElseKind(m.kind)) continue;
    const branches = forkBranchesOf(m);
    if (branches.length !== 2) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: "if/else needs Then and Else lanes",
      });
    }
    const thenLane = ifThenBranch(m);
    if (!thenLane?.modules.length) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: "Then lane is empty — add at least one step",
      });
    }
    const path = m.ifCondition?.path.trim() ?? "";
    if (!path) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: "if/else needs a condition path on the spine",
      });
      continue;
    }
    const loc = locatePipelineModule(modules, m.id);
    const spineType = loc?.predecessor ? stepSpineOutType(loc.predecessor) : m.inType;
    if (!spineType) continue;
    const at = typeExprAtPath(spineType, path, models, typeAliases);
    if (!at) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: `unknown condition path "${path}"`,
      });
    } else if (m.ifCondition) {
      const typeErr = ifConditionTypeError(m.ifCondition, at);
      if (typeErr) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: typeErr,
        });
      }
    }
  }
  return invalid;
}

function computeCaseInvalid(
  modules: PipelineModule[],
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (const m of flattenPipelineModules(modules)) {
    if (!isCaseKind(m.kind)) continue;
    const branches = forkBranchesOf(m);
    if (branches.length < 2) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: "case needs at least two arms",
      });
    }
    if (!branches.some((b) => b.modules.length)) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: "case needs at least one arm with a step",
      });
    }
    const defaults = branches.filter((b) => isDefaultCaseMatch(b.match));
    if (defaults.length > 1) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: "case can have only one default arm (_, *, or empty match)",
      });
    }
    const seen = new Set<string>();
    for (const b of branches) {
      if (isDefaultCaseMatch(b.match)) continue;
      const key = (b.match ?? "").trim();
      if (!key) continue;
      if (seen.has(key)) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: `duplicate case match "${key}"`,
        });
      }
      seen.add(key);
    }
    const path = m.ifCondition?.path.trim() ?? "";
    if (!path) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: "case needs a match path on the spine",
      });
      continue;
    }
    const loc = locatePipelineModule(modules, m.id);
    const spineType = loc?.predecessor ? stepSpineOutType(loc.predecessor) : m.inType;
    if (!spineType) continue;
    const at = typeExprAtPath(spineType, path, models, typeAliases);
    if (!at) {
      pushInvalid(invalid, {
        moduleId: m.id,
        kind: InvalidKind.StructureField,
        structureMessage: `unknown match path "${path}"`,
      });
    }
  }
  return invalid;
}

function computeExclusiveJoinInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    if (isExclusiveKind(m.kind)) {
      const nxt = modules[i + 1];
      if (nxt && !isControlJoinKind(nxt.kind)) {
        pushInvalid(invalid, {
          moduleId: nxt.id,
          kind: InvalidKind.StructureField,
          structureMessage: "steps after if/case do not run unless you add a Join — move them into a branch or insert Join",
        });
      }
    }
    if (isControlJoinKind(m.kind)) {
      const prev = i > 0 ? modules[i - 1] : undefined;
      if (!prev || !isExclusiveKind(prev.kind)) {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.StructureField,
          structureMessage: "Join must sit immediately after if/else or case",
        });
      }
    }
    if (isNestedLaneKind(m.kind)) {
      for (const b of forkBranchesOf(m)) mergeInvalid(invalid, computeExclusiveJoinInvalid(b.modules));
    }
  }
  return invalid;
}

function mergeInvalid(into: InvalidMap, from: InvalidMap): void {
  for (const [, issues] of from) {
    for (const issue of issues) pushInvalid(into, issue);
  }
}

// AI : canonical I/O-validity check — linear spine plus Fork lanes (series-parallel).
export function computeInvalid(
  modules: PipelineModule[],
  models: StructureModel[] = [],
  opts?: ComputeInvalidOpts,
): InvalidMap {
  // AI : project JSON stores user models only — shared Document must count for I/O + field refs.
  models = withSharedModels(models);
  const flat = flattenPipelineModules(modules);
  const invalid = computeLabelInvalid(flat);
  mergeInvalid(invalid, computeNoteInvalid(flat));
  mergeInvalid(invalid, computeWebhookInvalid(flat));
  mergeInvalid(invalid, computeN8nInvalid(modules));
  mergeInvalid(invalid, computeConnectInvalid(modules));
  mergeInvalid(invalid, computeExampleSelectInvalid(flat, models));
  mergeInvalid(invalid, computeMergeStateInvalid(flat, models));
  mergeInvalid(invalid, computeAssembleInvalid(flat, models, opts?.typeAliases ?? []));
  mergeInvalid(invalid, computeParallelInvalid(flat, models));
  mergeInvalid(invalid, computeMissingCombineBeforeInputInvalid(flat));
  mergeInvalid(invalid, computeForkInvalid(modules, models, opts?.typeAliases ?? []));
  mergeInvalid(invalid, computeIfElseInvalid(modules, models, opts?.typeAliases ?? []));
  mergeInvalid(invalid, computeCaseInvalid(modules, models, opts?.typeAliases ?? []));
  mergeInvalid(invalid, computeExclusiveJoinInvalid(modules));
  if (!pipelineDagIsAcyclic(pipelineToDag(modules))) {
    const first = modules[0];
    if (first) {
      pushInvalid(invalid, {
        moduleId: first.id,
        kind: InvalidKind.StructureField,
        structureMessage: "pipeline DAG has a cycle — loops belong in custom-code or llm-batch, not graph edges",
      });
    }
  }
  if (opts?.requireInputDescriptions) {
    mergeInvalid(invalid, computeInputDescriptionInvalid(flat));
  }
  for (const m of flat) {
    if (isForkKind(m.kind) || isExclusiveKind(m.kind) || isControlJoinKind(m.kind)) continue;
    if (usesPassthroughStructure(m.kind)) {
      if (!m.inStructureId) pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.NoOutput });
      continue;
    }
    if (!m.outStructureId) pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.NoOutput });
  }

  let flowType: TypeExpr | undefined = opts?.startPrev ? stepSpineOutType(opts.startPrev) : undefined;
  let flowId: StructureModelId | undefined = opts?.startPrev?.outStructureId;
  const byModel = new Set<StructureModelId>();
  if (flowId) byModel.add(flowId);

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    const prev = i > 0 ? modules[i - 1] : opts?.startPrev;

    if (m.kind === ModuleKind.Input) {
      if (inputFeedsCombine(modules, i)) continue;
      const outType = stepSpineOutType(m);
      if (m.outStructureId) {
        flowId = m.outStructureId;
        flowType = outType;
        byModel.add(m.outStructureId);
      }
      continue;
    }

    if (m.kind === ModuleKind.Combine) {
      if (m.inStructureId && !byModel.has(m.inStructureId)) {
        const spineUpstream = flowId && flowId !== m.inStructureId ? flowId : undefined;
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.IoMismatch,
          expects: m.inStructureId,
          upstreamEmits: spineUpstream,
          expectsType: modelName(models, m.inStructureId),
          upstreamType: modelName(models, spineUpstream) ?? "?",
        });
      }
      if (m.outStructureId) {
        flowId = m.outStructureId;
        flowType = stepSpineOutType(m);
        byModel.add(m.outStructureId);
      }
      continue;
    }

    // AI : assemble zips spine + state["Label"] — leftover structureIn (e.g. Resume from combine) is not a linear hop.
    if (m.kind === ModuleKind.Assemble) {
      if (m.outStructureId) {
        flowId = m.outStructureId;
        flowType = stepSpineOutType(m);
        byModel.add(m.outStructureId);
      }
      continue;
    }

    if (isNestedLaneKind(m.kind)) {
      const upstreamType = (prev && stepSpineOutType(prev)) ?? flowType;
      const expected = stepSpineInType(m) ?? upstreamType;
      if (expected && upstreamType && !stepAcceptsSpineType(m, expected, upstreamType, models, opts?.typeAliases ?? [])) {
        pushInvalid(invalid, spineMismatchIssue(m.id, expected, upstreamType, models));
      }
      for (const b of forkBranchesOf(m)) {
        mergeInvalid(invalid, computeInvalid(b.modules, models, { ...opts, startPrev: prev, laneJoinConsumesLast: true }));
      }
      const outType = stepSpineOutType(m);
      if (outType) flowType = outType;
      if (m.outStructureId) {
        flowId = m.outStructureId;
        byModel.add(m.outStructureId);
      }
      continue;
    }

    // AI : combine-side parse llm converts the side input's document — it feeds the combine's
    // AI : newDocument, not the spine, so skip flow/byModel updates (in/out are sync-managed).
    if (isCombineSideParseStep(modules, i)) continue;

    if (usesPassthroughStructure(m.kind)) {
      if (invalidIssuesForModule(invalid, m.id).some((x) => x.kind === InvalidKind.NoOutput)) continue;
      const expected = stepSpineInType(m);
      const upstreamType = (prev && stepSpineOutType(prev)) ?? flowType;
      if (!expected || !upstreamType || !stepAcceptsSpineType(m, expected, upstreamType, models, opts?.typeAliases ?? [])) {
        if (expected && upstreamType) {
          pushInvalid(invalid, spineMismatchIssue(m.id, expected, upstreamType, models));
        } else {
          pushInvalid(invalid, {
            moduleId: m.id,
            kind: InvalidKind.IoMismatch,
            expects: m.inStructureId,
            upstreamEmits: stepEmits(prev) ?? flowId,
            expectsType: expected ? formatTypeExpr(expected, models) : modelName(models, m.inStructureId),
            upstreamType: upstreamType ? formatTypeExpr(upstreamType, models) : modelName(models, stepEmits(prev) ?? flowId) ?? "?",
          });
        }
      } else if (m.inStructureId) {
        flowId = m.inStructureId;
        flowType = expected;
      }
      continue;
    }

    if (!m.inStructureId || invalidIssuesForModule(invalid, m.id).some((x) => x.kind === InvalidKind.NoOutput)) continue;

    const expected = stepSpineInType(m);
    const upstreamType = (prev && stepSpineOutType(prev)) ?? flowType;
    if (!expected || !upstreamType || !stepAcceptsSpineType(m, expected, upstreamType, models, opts?.typeAliases ?? [])) {
      if (expected && upstreamType) {
        pushInvalid(invalid, spineMismatchIssue(m.id, expected, upstreamType, models));
      } else {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: InvalidKind.IoMismatch,
          expects: m.inStructureId,
          upstreamEmits: stepEmits(prev) ?? flowId,
          expectsType: expected ? formatTypeExpr(expected, models) : modelName(models, m.inStructureId),
          upstreamType: upstreamType ? formatTypeExpr(upstreamType, models) : modelName(models, stepEmits(prev) ?? flowId) ?? "?",
        });
      }
      continue;
    }

    if (m.outStructureId) {
      flowId = m.outStructureId;
      flowType = stepSpineOutType(m);
      byModel.add(m.outStructureId);
    }

    const transformIssue = transformListWrapInvalid(m, prev, models);
    if (transformIssue) pushInvalid(invalid, transformIssue);
    const flattenIssue = transformListFlattenInvalid(m, prev, models);
    if (flattenIssue) pushInvalid(invalid, flattenIssue);
  }

  for (const [id, issues] of computeUnusedOutputInvalid(modules, models, opts?.laneJoinConsumesLast)) {
    for (const issue of issues) {
      if (!invalidIssuesForModule(invalid, id).some((x) => x.kind === issue.kind)) {
        pushInvalid(invalid, issue);
      }
    }
  }
  for (const [id, issues] of computeDuplicateIoStructInvalid(modules)) {
    for (const issue of issues) {
      if (!invalidIssuesForModule(invalid, id).some((x) => x.kind === issue.kind)) {
        pushInvalid(invalid, issue);
      }
    }
  }
  for (const [id, issues] of computeStateKeyInvalid(modules)) {
    for (const issue of issues) {
      pushInvalid(invalid, issue);
    }
  }
  for (const [id, issues] of computeMissingStructureInvalid(modules, models)) {
    for (const issue of issues) {
      pushInvalid(invalid, issue);
    }
  }
  for (const [id, issues] of computeJsonInputMismatchInvalid(modules, models)) {
    for (const issue of issues) {
      pushInvalid(invalid, issue);
    }
  }
  for (const [id, issues] of computeLlmDocumentFieldInvalid(modules, models)) {
    for (const issue of issues) {
      pushInvalid(invalid, issue);
    }
  }
  for (const [id, issues] of computeCombineOutputInvalid(modules, models)) {
    for (const issue of issues) {
      pushInvalid(invalid, issue);
    }
  }
  for (const [id, issues] of computeInputAssignedDocInvalid(modules, opts)) {
    for (const issue of issues) {
      pushInvalid(invalid, issue);
    }
  }
  for (const [id, issues] of computeCodeCompileInvalid(modules)) {
    for (const issue of issues) {
      pushInvalid(invalid, issue);
    }
  }
  for (const [id, issues] of computeStructureFieldInvalid(modules, models, opts?.typeAliases ?? [])) {
    for (const issue of issues) {
      pushInvalid(invalid, issue);
    }
  }

  return invalid;
}

// AI : middle steps must feed a downstream inStructureId, assemble state["Label"], or the next combine/assemble.
function assembleStateLabels(modules: PipelineModule[]): Set<string> {
  const labels = new Set<string>();
  for (const m of flattenPipelineModules(modules)) {
    if (m.kind !== ModuleKind.Assemble && !(isForkKind(m.kind) && forkJoinOf(m) === "assemble")) continue;
    for (const src of Object.values(m.assembleBindings ?? {})) {
      if (src.kind === "state" && src.label.trim()) labels.add(src.label.trim());
      if (src.kind === "path" && typeof src.from === "object" && src.from.label.trim()) {
        labels.add(src.from.label.trim());
      }
    }
  }
  return labels;
}

function computeUnusedOutputInvalid(
  modules: PipelineModule[],
  models: StructureModel[],
  laneJoinConsumesLast?: boolean,
): InvalidMap {
  const invalid: InvalidMap = new Map();
  const assembleLabels = assembleStateLabels(modules);
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    const emitted = stepEmits(m);
    if (!emitted || m.kind === ModuleKind.Input || usesPassthroughStructure(m.kind) || isExclusiveKind(m.kind)) continue;
    if (laneJoinConsumesLast && i === modules.length - 1) continue;
    // AI : a combine consumes the previous step's output as its newDocument regardless of inStructureId.
    if (modules[i + 1]?.kind === ModuleKind.Combine || modules[i + 1]?.kind === ModuleKind.Assemble || isNestedLaneKind(modules[i + 1]?.kind ?? "")) continue;
    if (assembleLabels.has(m.label.trim())) continue;
    // AI : Link Quotes is a managed follower — assemble binding the LLM still consumes the quote step.
    if (isAutoQuoteStep(m) && i > 0 && assembleLabels.has(modules[i - 1]!.label.trim())) continue;
    const used = modules.slice(i + 1).some((down) => {
      if (down.inStructureId === emitted) return true;
      const expected = stepSpineInType(down);
      const actual = stepSpineOutType(m);
      // AI : example-select unwraps the sole list[T] field on a combine wrapper struct.
      return (
        isExampleSelectKind(down.kind) &&
        !!expected &&
        !!actual &&
        exampleSelectAcceptsWrapper(expected, actual, models)
      );
    });
    if (!used) pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.UnusedOutput, expects: emitted });
  }
  return invalid;
}

function computeDuplicateIoStructInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  const spineInputStructs = new Set<StructureModelId>();
  const outputByStruct = new Map<StructureModelId, ModuleId[]>();

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    if (m.kind === ModuleKind.Input && m.outStructureId) {
      if (inputFeedsCombine(modules, i) || inputFeedsAssemble(modules, i)) continue;
      if (spineInputStructs.has(m.outStructureId)) {
        pushInvalid(invalid, { moduleId: m.id, kind: InvalidKind.DuplicateInputStruct, expects: m.outStructureId });
      } else {
        spineInputStructs.add(m.outStructureId);
      }
    }
    if (m.kind === ModuleKind.Output && m.inStructureId) {
      const ids = outputByStruct.get(m.inStructureId) ?? [];
      ids.push(m.id);
      outputByStruct.set(m.inStructureId, ids);
    }
  }

  for (const ids of outputByStruct.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) pushInvalid(invalid, { moduleId: id, kind: InvalidKind.DuplicateOutputStruct });
  }

  return invalid;
}

// AI : warnings don't block runs — empty LLM prompts fall back at runtime but should be visible.
function llmPromptQuoteMismatch(prompt: string, model: StructureModel): string | null {
  const quoteTypes = new Set<string>([FieldType.TupleTextQuote, FieldType.ListTupleTextQuote]);
  for (const f of model.fields) {
    if (quoteTypes.has(f.type)) continue;
    const name = f.name.trim();
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:quote\\w*|quoted)\\W{0,40}${escaped}|${escaped}\\W{0,40}(?:quote\\w*|quoted)`, "i");
    if (re.test(prompt)) {
      return `${model.name}.${name} is ${f.type} but the prompt asks to quote it`;
    }
  }
  return null;
}

function llmPromptWantsExplodeList(prompt: string): boolean {
  return /\breturn(?:s|ed)? (?:them |it )?(?:as )?(?:a )?list\b|\bas a list of json\b|\bone (?:spreadsheet )?row per\b|\ball action items\b/i.test(
    prompt,
  );
}

function modelHasListField(model: StructureModel): boolean {
  return model.fields.some((f) => fieldToTypeExpr(f).kind === TypeExprKind.List);
}

export function computeWarnings(
  modules: PipelineModule[],
  models: StructureModel[] = [],
): Map<ModuleId, PipelineWarning[]> {
  models = withSharedModels(models);
  const warnings = new Map<ModuleId, PipelineWarning[]>();
  const add = (moduleId: ModuleId, issue: PipelineWarning) => {
    const list = warnings.get(moduleId) ?? [];
    list.push(issue);
    warnings.set(moduleId, list);
  };

  const reachable = pipelineReachableModelIds(modules, models);
  const anchorId = modules[0]?.id;
  if (anchorId) {
    for (const model of models) {
      if (isLockedStructureModel(model)) continue;
      if (reachable.has(model.id)) continue;
      add(anchorId, {
        moduleId: anchorId,
        kind: PipelineWarningKind.UnusedModel,
        detail: `${model.name} is never used by any step — omit clones of Document`,
      });
    }
  }

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    if (isLlmKind(m.kind) && !m.prompt?.trim()) {
      add(m.id, { moduleId: m.id, kind: PipelineWarningKind.NoPrompt });
    }
    if (isLlmKind(m.kind) && m.prompt?.trim() && m.outStructureId) {
      const out = models.find((x) => x.id === m.outStructureId);
      const mismatch = out ? llmPromptQuoteMismatch(m.prompt, out) : null;
      if (mismatch) {
        add(m.id, { moduleId: m.id, kind: PipelineWarningKind.PromptQuoteMismatch, detail: mismatch });
      }
      if (m.kind === ModuleKind.LlmBatch && out && llmPromptWantsExplodeList(m.prompt) && !modelHasListField(out)) {
        add(m.id, {
          moduleId: m.id,
          kind: PipelineWarningKind.PromptListVsItem,
          detail: `${out.name} is one object per file but the prompt asks for a list of rows — wrap in list[...] then flatten`,
        });
      }
    }
    if (m.kind === ModuleKind.Quote && !isAutoQuoteStep(m) && m.outStructureId) {
      const out = models.find((x) => x.id === m.outStructureId);
      if (out && !hasQuoteField(out, models)) {
        add(m.id, { moduleId: m.id, kind: PipelineWarningKind.QuoteNoFields });
      }
    }
    const prev = i > 0 ? modules[i - 1] : undefined;
    if (
      m.kind === ModuleKind.Transform &&
      !m.code?.trim() &&
      !stepEmitsList(m) &&
      stepEmitsList(prev) &&
      m.inStructureId === m.outStructureId &&
      m.outStructureId
    ) {
      const out = models.find((x) => x.id === m.outStructureId);
      if (out && listFieldsForWrap(out).length === 0) {
        add(m.id, { moduleId: m.id, kind: PipelineWarningKind.TransformMultiList });
      }
    }
  }

  return warnings;
}

// AI : human-readable validation report for assistants, retry prompts, and copy-to-clipboard.
export function formatInvalidMapErrors(
  invalid: InvalidMap,
  modules: PipelineModule[],
  models: StructureModel[] = [],
): string {
  if (invalid.size === 0) return "";
  const lines: string[] = [];
  for (const issues of invalid.values()) {
    for (const issue of issues) {
      const step = modules.find((m) => m.id === issue.moduleId);
      const label = step?.label ?? issue.moduleId;
      const kind = step?.kind ?? "?";
      lines.push(`- "${label}" (${kind}): ${invalidStepMessage(issue, models, modules)}`);
    }
  }
  return lines.join("\n");
}

export function formatPipelineValidationErrors(
  modules: PipelineModule[],
  models: StructureModel[] = [],
  typeAliases: TypeAlias[] = [],
): string {
  return formatInvalidMapErrors(computeInvalid(modules, models, { typeAliases }), modules, models);
}

// AI : A/B strategies use the pipeline's own LLM prompt — not a hardcoded legal brief.
export function pipelineTaskPrompt(modules: PipelineModule[]): string {
  const outMod = [...modules].reverse().find((m) => m.kind === ModuleKind.Output);
  const targetId = outMod?.inStructureId;
  if (targetId) {
    const direct = modules.find(
      (m) => isLlmKind(m.kind) && m.outStructureId === targetId && m.prompt?.trim(),
    );
    if (direct?.prompt) return direct.prompt.trim();
  }
  const withPrompt = modules.filter((m) => isLlmKind(m.kind) && m.prompt?.trim());
  if (withPrompt.length) return withPrompt[withPrompt.length - 1].prompt!.trim();
  throw new Error("pipeline has no LLM prompt for benchmark — add a prompt to an LLM step");
}

export function pipelineOutputModel(project: Project): StructureModel {
  const outMod = [...project.modules].reverse().find((m) => m.kind === "output");
  if (!outMod?.inStructureId) throw new Error("pipeline has no output step with a structure to materialize");
  const m = project.models.find((x) => x.id === outMod.inStructureId);
  if (!m) throw new Error(`unknown output structure ${outMod.inStructureId}`);
  return m;
}

