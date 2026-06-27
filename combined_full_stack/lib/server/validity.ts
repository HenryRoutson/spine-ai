// AI : TODO refactor — ~800 lines; split I/O graph checks, warnings, auto-quote migration, issue messages.
import type {
  ModuleId,
  PipelineModule,
  Project,
  StructureModel,
  StructureModelId,
} from "./types";
import { migrateCustomCodeModule, customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { assertEntriesForModule, parseAssertReferencedLabels } from "@/lib/assert_steps";
import { hasQuoteField, listFieldsForWrap, isBuiltinDocumentModel } from "./structure";
import { stripSharedModels, withSharedModels } from "./builtin_models";
import { isLlmKind } from "@/lib/module-kinds";
import {
  cardinalityMismatch,
  formatTypeExpr,
  stepEmitsList,
  stepSpineInType,
  stepSpineOutType,
  typeExprEqual,
  type TypeExpr,
} from "./type_expr";

export { stepEmitsList } from "./type_expr";

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
  | "missing-input-description";

export interface InvalidStep {
  moduleId: ModuleId;
  kind: InvalidKind;
  expects?: StructureModelId;
  upstreamEmits?: StructureModelId;
  expectsType?: string;
  upstreamType?: string;
  missingLabel?: string;
}

export type InvalidMap = Map<ModuleId, InvalidStep[]>;

export function invalidForModule(invalid: InvalidMap, moduleId: ModuleId): InvalidStep | undefined {
  return invalid.get(moduleId)?.[0];
}

export function invalidIssuesForModule(invalid: InvalidMap, moduleId: ModuleId): InvalidStep[] {
  return invalid.get(moduleId) ?? [];
}

function pushInvalid(invalid: InvalidMap, issue: InvalidStep): void {
  const list = invalid.get(issue.moduleId) ?? [];
  if (list.some((x) => x.kind === issue.kind && x.expectsType === issue.expectsType && x.missingLabel === issue.missingLabel)) {
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
      kind: "cardinality-mismatch",
      expectsType,
      upstreamType,
      expects: expected.kind === "ref" ? expected.modelId : expected.kind === "list" && expected.item.kind === "ref" ? expected.item.modelId : undefined,
      upstreamEmits: actual.kind === "ref" ? actual.modelId : actual.kind === "list" && actual.item.kind === "ref" ? actual.item.modelId : undefined,
    };
  }
  return {
    moduleId,
    kind: "io-mismatch",
    expectsType,
    upstreamType,
    expects: expected.kind === "ref" ? expected.modelId : expected.kind === "list" && expected.item.kind === "ref" ? expected.item.modelId : undefined,
    upstreamEmits: actual.kind === "ref" ? actual.modelId : actual.kind === "list" && actual.item.kind === "ref" ? actual.item.modelId : undefined,
  };
}

function stepAcceptsSpineType(m: PipelineModule, expected: TypeExpr, actual: TypeExpr): boolean {
  if (typeExprEqual(expected, actual)) return true;
  if (!cardinalityMismatch(expected, actual)) return false;
  // AI : custom-code / coded transform steps reshape list↔object at runtime — spine item type still matches.
  if (m.kind === "custom-code" || (m.kind === "transform" && !!m.code?.trim())) return true;
  // AI : output/assert snapshot spine as-is; quote links list or scalar extracts.
  if (m.kind === "output" || m.kind === "assert" || m.kind === "quote") return true;
  return false;
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
  if (m.kind !== "transform" || m.code?.trim() || m.outIsList || !stepEmitsList(prev)) return undefined;
  const out = models.find((x) => x.id === m.outStructureId);
  if (!out) return undefined;
  // AI : same in/out unwraps only when the upstream list has exactly one item — checked as a warning.
  if (m.inStructureId === m.outStructureId) return undefined;
  if (listFieldsForWrap(out).length > 0) return undefined;
  return { moduleId: m.id, kind: "transform-list-wrap", expects: m.inStructureId, upstreamEmits: m.outStructureId };
}

export interface PipelineWarning {
  moduleId: ModuleId;
  kind: "no-prompt" | "quote-no-fields" | "transform-multi-list" | "json-input-type";
}

// AI : what structure a step puts on the linear spine for the *next* step (output passthrough).
export function stepEmits(m: PipelineModule | undefined): StructureModelId | undefined {
  const spine = stepSpineOutType(m);
  if (!spine) return undefined;
  if (spine.kind === "ref") return spine.modelId;
  if (spine.kind === "list" && spine.item.kind === "ref") return spine.item.modelId;
  return m?.outStructureId ?? m?.inStructureId;
}

function computeLabelInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  const byLabel = new Map<string, ModuleId[]>();
  for (const m of modules) {
    const label = m.label.trim();
    if (!label) {
      pushInvalid(invalid, { moduleId: m.id, kind: "empty-label" });
      continue;
    }
    const ids = byLabel.get(label) ?? [];
    ids.push(m.id);
    byLabel.set(label, ids);
  }
  for (const ids of byLabel.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) pushInvalid(invalid, { moduleId: id, kind: "duplicate-label" });
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
    if (m.kind !== "assert" && m.kind !== "custom-code" && m.kind !== "transform") continue;
    const entries =
      m.kind === "assert"
        ? assertEntriesForModule(m).map((e) => e.code)
        : customCodeEntriesForModule(m).map((e) => e.code);
    const code = entries.join("\n") || m.code || "";
    if (!code.trim()) continue;
    const scope = labelsInScope(modules, i);
    for (const label of parseAssertReferencedLabels(code)) {
      if (!scope.has(label)) {
        pushInvalid(invalid, { moduleId: m.id, kind: "state-key-missing", missingLabel: label });
      }
    }
  }
  return invalid;
}

export type ComputeInvalidOpts = {
  requireInputDescriptions?: boolean;
};

function computeInputDescriptionInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (const m of modules) {
    if (isAutoQuoteStep(m)) continue;
    if (m.inputDescription?.trim()) continue;
    pushInvalid(invalid, { moduleId: m.id, kind: "missing-input-description" });
  }
  return invalid;
}

// AI : canonical I/O-validity check — strictly linear except combine (pipeline state + side doc).
export function computeInvalid(
  modules: PipelineModule[],
  models: StructureModel[] = [],
  opts?: ComputeInvalidOpts,
): InvalidMap {
  const invalid = computeLabelInvalid(modules);
  if (opts?.requireInputDescriptions) {
    for (const [moduleId, issues] of computeInputDescriptionInvalid(modules)) {
      const list = invalid.get(moduleId) ?? [];
      list.push(...issues);
      invalid.set(moduleId, list);
    }
  }
  for (const m of modules) {
    if (m.kind === "output" || m.kind === "assert") {
      if (!m.inStructureId) pushInvalid(invalid, { moduleId: m.id, kind: "no-output" });
      continue;
    }
    if (!m.outStructureId) pushInvalid(invalid, { moduleId: m.id, kind: "no-output" });
  }

  let flowType: TypeExpr | undefined;
  let flowId: StructureModelId | undefined;
  const byModel = new Set<StructureModelId>();

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    const prev = i > 0 ? modules[i - 1] : undefined;

    if (m.kind === "input") {
      if (modules[i + 1]?.kind === "combine") continue;
      const outType = stepSpineOutType(m);
      if (m.outStructureId) {
        flowId = m.outStructureId;
        flowType = outType;
        byModel.add(m.outStructureId);
      }
      continue;
    }

    if (m.kind === "combine") {
      if (m.inStructureId && !byModel.has(m.inStructureId)) {
        const spineUpstream = flowId && flowId !== m.inStructureId ? flowId : undefined;
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: "io-mismatch",
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

    if (m.kind === "output" || m.kind === "assert") {
      if (invalidIssuesForModule(invalid, m.id).some((x) => x.kind === "no-output")) continue;
      const expected = stepSpineInType(m);
      const upstreamType = (prev && stepSpineOutType(prev)) ?? flowType;
      if (!expected || !upstreamType || !stepAcceptsSpineType(m, expected, upstreamType)) {
        if (expected && upstreamType) {
          pushInvalid(invalid, spineMismatchIssue(m.id, expected, upstreamType, models));
        } else {
          pushInvalid(invalid, {
            moduleId: m.id,
            kind: "io-mismatch",
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

    if (!m.inStructureId || invalidIssuesForModule(invalid, m.id).some((x) => x.kind === "no-output")) continue;

    const expected = stepSpineInType(m);
    const upstreamType = (prev && stepSpineOutType(prev)) ?? flowType;
    if (!expected || !upstreamType || !stepAcceptsSpineType(m, expected, upstreamType)) {
      if (expected && upstreamType) {
        pushInvalid(invalid, spineMismatchIssue(m.id, expected, upstreamType, models));
      } else {
        pushInvalid(invalid, {
          moduleId: m.id,
          kind: "io-mismatch",
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
  }

  for (const [id, issues] of computeUnusedOutputInvalid(modules)) {
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

  return invalid;
}

// AI : middle steps must feed a downstream inStructureId (combine counts via inStructureId).
function computeUnusedOutputInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    const emitted = stepEmits(m);
    if (!emitted || m.kind === "input" || m.kind === "output" || m.kind === "assert") continue;
    const used = modules.slice(i + 1).some((down) => down.inStructureId === emitted);
    if (!used) pushInvalid(invalid, { moduleId: m.id, kind: "unused-output", expects: emitted });
  }
  return invalid;
}

function computeDuplicateIoStructInvalid(modules: PipelineModule[]): InvalidMap {
  const invalid: InvalidMap = new Map();
  const spineInputStructs = new Set<StructureModelId>();
  const outputByStruct = new Map<StructureModelId, ModuleId[]>();

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    if (m.kind === "input" && m.outStructureId) {
      const beforeCombine = modules[i + 1]?.kind === "combine";
      if (beforeCombine) continue;
      if (spineInputStructs.has(m.outStructureId)) {
        pushInvalid(invalid, { moduleId: m.id, kind: "duplicate-input-struct", expects: m.outStructureId });
      } else {
        spineInputStructs.add(m.outStructureId);
      }
    }
    if (m.kind === "output" && m.inStructureId) {
      const ids = outputByStruct.get(m.inStructureId) ?? [];
      ids.push(m.id);
      outputByStruct.set(m.inStructureId, ids);
    }
  }

  for (const ids of outputByStruct.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) pushInvalid(invalid, { moduleId: id, kind: "duplicate-output-struct" });
  }

  return invalid;
}

// AI : warnings don't block runs — empty LLM prompts fall back at runtime but should be visible.
export function computeWarnings(
  modules: PipelineModule[],
  models: StructureModel[] = [],
): Map<ModuleId, PipelineWarning[]> {
  const warnings = new Map<ModuleId, PipelineWarning[]>();
  const add = (moduleId: ModuleId, issue: PipelineWarning) => {
    const list = warnings.get(moduleId) ?? [];
    list.push(issue);
    warnings.set(moduleId, list);
  };

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    if (m.kind === "input" && moduleInputTypes(m).includes("json")) {
      const out = models.find((x) => x.id === m.outStructureId);
      if (isBuiltinDocumentModel(out)) {
        add(m.id, { moduleId: m.id, kind: "json-input-type" });
      }
    }
    if (isLlmKind(m.kind) && !m.prompt?.trim()) {
      add(m.id, { moduleId: m.id, kind: "no-prompt" });
    }
    if (m.kind === "quote" && !isAutoQuoteStep(m) && m.outStructureId) {
      const out = models.find((x) => x.id === m.outStructureId);
      if (out && !hasQuoteField(out, models)) {
        add(m.id, { moduleId: m.id, kind: "quote-no-fields" });
      }
    }
    const prev = i > 0 ? modules[i - 1] : undefined;
    if (
      m.kind === "transform" &&
      !m.code?.trim() &&
      !m.outIsList &&
      stepEmitsList(prev) &&
      m.inStructureId === m.outStructureId &&
      m.outStructureId
    ) {
      const out = models.find((x) => x.id === m.outStructureId);
      if (out && listFieldsForWrap(out).length === 0) {
        add(m.id, { moduleId: m.id, kind: "transform-multi-list" });
      }
    }
  }

  return warnings;
}

export function warningStepMessage(
  issue: PipelineWarning,
  models: StructureModel[],
  modules: PipelineModule[],
): string {
  if (issue.kind === "no-prompt") return "no prompt — schema-only call at runtime";
  if (issue.kind === "json-input-type") return "JSON file type is not typed — set I/O model to a structure";
  if (issue.kind === "quote-no-fields") return "output model has no quote fields";
  if (issue.kind === "transform-multi-list") {
    const m = modules.find((x) => x.id === issue.moduleId);
    const name = modelName(models, m?.outStructureId) ?? "output";
    return `upstream list → ${name} only auto-unwraps one item — add a list field or custom TS if batch size may exceed 1`;
  }
  return "warning";
}

export function warningStepMessages(
  issues: PipelineWarning[] | undefined,
  models: StructureModel[],
  modules: PipelineModule[],
): string[] {
  return (issues ?? []).map((issue) => warningStepMessage(issue, models, modules));
}

// AI : human-readable validation report for assistants and retry prompts.
export function formatPipelineValidationErrors(
  modules: PipelineModule[],
  models: StructureModel[] = [],
): string {
  const invalid = computeInvalid(modules, models);
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

export type IoMismatchFixKind = "adopt-upstream" | "align-upstream";

export type IoMismatchFixHint = {
  kind: IoMismatchFixKind;
  label: string;
};

export type IoMismatchInspectorFix = {
  mismatchModuleId: ModuleId;
  kind: IoMismatchFixKind;
  label: string;
  message: string;
};

// AI : when step input expects X but upstream emits Y — two one-click alignments.
export function ioMismatchFixHints(
  issue: InvalidStep,
  models: StructureModel[],
): IoMismatchFixHint[] | undefined {
  if (issue.kind !== "io-mismatch" || !issue.expects || !issue.upstreamEmits) return undefined;
  const expected = modelName(models, issue.expects);
  const upstream = modelName(models, issue.upstreamEmits);
  if (!expected || !upstream || expected === upstream) return undefined;
  return [
    { kind: "adopt-upstream", label: `${expected} → ${upstream}` },
    { kind: "align-upstream", label: `${upstream} → ${expected}` },
  ];
}

export function prevModuleId(modules: PipelineModule[], moduleId: ModuleId): ModuleId | undefined {
  const i = modules.findIndex((m) => m.id === moduleId);
  return i > 0 ? modules[i - 1]!.id : undefined;
}

function isSpineMismatchKind(kind: InvalidKind): boolean {
  return kind === "io-mismatch" || kind === "cardinality-mismatch";
}

// AI : red connector / upstream border — downstream step index carries the io-mismatch invalid flag.
export function ioMismatchAtModuleIndex(
  modules: PipelineModule[],
  invalid: InvalidMap | undefined,
  moduleIndex: number,
): boolean {
  if (!invalid || moduleIndex < 0 || moduleIndex >= modules.length) return false;
  const m = modules[moduleIndex]!;
  if (m.kind === "input" && modules[moduleIndex + 1]?.kind === "combine") {
    const issue = invalidForModule(invalid, modules[moduleIndex + 1]!.id);
    return !!issue && isSpineMismatchKind(issue.kind);
  }
  const issue = invalidForModule(invalid, m.id);
  return !!issue && isSpineMismatchKind(issue.kind);
}

export function ioMismatchUpstreamOf(
  moduleId: ModuleId,
  modules: PipelineModule[],
  invalid: InvalidMap | undefined,
): boolean {
  if (!invalid) return false;
  for (const [downId, issues] of invalid) {
    for (const issue of issues) {
      if (!isSpineMismatchKind(issue.kind)) continue;
      if (prevModuleId(modules, downId) === moduleId) return true;
      const downIdx = modules.findIndex((m) => m.id === downId);
      const down = modules[downIdx];
      if (down?.kind === "combine" && downIdx >= 2 && modules[downIdx - 1]?.kind === "input") {
        if (modules[downIdx - 2]?.id === moduleId) return true;
      }
    }
  }
  return false;
}

export function stepIoMismatchLinked(
  moduleId: ModuleId,
  modules: PipelineModule[],
  invalid: InvalidMap | undefined,
): boolean {
  if (!invalid) return false;
  const issue = invalidForModule(invalid, moduleId);
  if (issue && isSpineMismatchKind(issue.kind)) return true;
  return ioMismatchUpstreamOf(moduleId, modules, invalid);
}

// AI : one inspector fix per step — downstream gets adopt-upstream, upstream gets align-upstream.
export function ioMismatchInspectorFix(
  moduleId: ModuleId,
  modules: PipelineModule[],
  invalid: InvalidMap,
  models: StructureModel[],
): IoMismatchInspectorFix | undefined {
  const own = invalidForModule(invalid, moduleId);
  if (own && isSpineMismatchKind(own.kind)) {
    const adopt = ioMismatchFixHints(own, models)?.find((h) => h.kind === "adopt-upstream");
    return {
      mismatchModuleId: moduleId,
      kind: "adopt-upstream",
      label: adopt?.label ?? "",
      message: invalidStepMessage(own, models, modules),
    };
  }

  for (const [downId, issues] of invalid) {
    for (const issue of issues) {
      if (!isSpineMismatchKind(issue.kind) || prevModuleId(modules, downId) !== moduleId) continue;
      const align = ioMismatchFixHints(issue, models)?.find((h) => h.kind === "align-upstream");
      return {
        mismatchModuleId: downId,
        kind: "align-upstream",
        label: align?.label ?? "",
        message: invalidStepMessage(issue, models, modules),
      };
    }
  }

  return undefined;
}

export function stepIoMismatchMessage(
  moduleId: ModuleId,
  modules: PipelineModule[],
  invalid: InvalidMap,
  models: StructureModel[],
): string | undefined {
  const fix = ioMismatchInspectorFix(moduleId, modules, invalid, models);
  if (fix) return fix.message;
  const own = invalidForModule(invalid, moduleId);
  if (own && isSpineMismatchKind(own.kind)) return invalidStepMessage(own, models, modules);
  return undefined;
}

export function invalidStepMessage(
  issue: InvalidStep,
  models: StructureModel[],
  modules: PipelineModule[],
): string {
  if (issue.kind === "no-output") {
    const m = modules.find((x) => x.id === issue.moduleId);
    if (m?.kind === "output") return "select a structure to materialize";
    if (m?.kind === "assert") return "select passthrough structure";
    return "select an output model";
  }
  if (issue.kind === "io-mismatch") {
    const m = modules.find((x) => x.id === issue.moduleId);
    const expected = issue.expectsType ?? modelName(models, issue.expects);
    if (m?.kind === "combine" && issue.expects) {
      if (!issue.upstreamEmits) {
        return `pipeline state has no ${expected ?? "structure"} — no upstream step has emitted this structure`;
      }
      const upstream = issue.upstreamType ?? modelName(models, issue.upstreamEmits) ?? "?";
      return `pipeline state expects ${expected}, spine carries ${upstream}`;
    }
    const upstream = issue.upstreamType ?? modelName(models, issue.upstreamEmits) ?? "?";
    return `input expects ${expected ?? "?"}, upstream emits ${upstream}`;
  }
  if (issue.kind === "cardinality-mismatch") {
    return `input expects ${issue.expectsType ?? "?"}, upstream emits ${issue.upstreamType ?? "?"}`;
  }
  if (issue.kind === "state-key-missing") {
    return `references unknown step label "${issue.missingLabel ?? "?"}" — no prior step has this label`;
  }
  if (issue.kind === "transform-list-wrap") {
    const m = modules.find((x) => x.id === issue.moduleId);
    const inName = modelName(models, issue.expects) ?? "item";
    const outName = modelName(models, issue.upstreamEmits) ?? "output";
    return `list[${inName}] → ${outName} needs a list field (prefer list[model] ref ${inName}) or custom TS code`;
  }
  if (issue.kind === "empty-label") {
    return "step label is required — labels key the accumulated pipeline state";
  }
  if (issue.kind === "duplicate-label") {
    const step = modules.find((x) => x.id === issue.moduleId);
    return `duplicate label "${step?.label ?? "?"}" — each step label must be unique`;
  }
  if (issue.kind === "unused-output") {
    const name = modelName(models, issue.expects) ?? "output";
    return `${name} is never consumed by a downstream step`;
  }
  if (issue.kind === "duplicate-input-struct") {
    const name = modelName(models, issue.expects) ?? "structure";
    return `multiple input steps emit ${name} — use distinct structures or a combine step`;
  }
  if (issue.kind === "duplicate-output-struct") {
    const m = modules.find((x) => x.id === issue.moduleId);
    const name = modelName(models, m?.inStructureId) ?? "structure";
    return `multiple output steps materialize ${name}`;
  }
  if (issue.kind === "missing-input-description") {
    return "input description is required — describe what data this step expects";
  }
  return "invalid step";
}

// AI : A/B strategies use the pipeline's own LLM prompt — not a hardcoded legal brief.
export function pipelineTaskPrompt(modules: PipelineModule[]): string {
  const outMod = [...modules].reverse().find((m) => m.kind === "output");
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

export function isPipelineValid(modules: PipelineModule[], models: StructureModel[] = []): boolean {
  return computeInvalid(modules, models).size === 0;
}

// AI : a step's run button is enabled only when the pipeline is valid AND the step is
// AI : cached or has an input ready (demo_outline: "run button on each step which has a cached or input").
// AI : TODO refactor — fix canRunStep semantics or remove API if per-step run stays unsupported.
// AI : TODO bug — "cached" here is the m.cached CONFIG toggle, not whether a cache artifact
// AI : actually exists for the step's key (run_engine readCache); a cached:true step with no
// AI : cache file lights up with nothing to serve. Also: there is no per-step run entry point
// AI : in the engine at all — only the whole-pipeline runPipeline (demo_outline §2/§4).
export function canRunStep(
  modules: PipelineModule[],
  moduleId: ModuleId,
  hasInput: boolean,
  models: StructureModel[] = [],
): boolean {
  if (!isPipelineValid(modules, models)) return false;
  const m = modules.find((x) => x.id === moduleId);
  if (!m) return false;
  return m.cached || m.kind === "input" || hasInput;
}

export function modelName(models: StructureModel[], id?: StructureModelId): string | undefined {
  return models.find((m) => m.id === id)?.name;
}

export const AUTO_QUOTE_EXPLAINER =
  "Auto-inserted when an LLM output includes quote fields. Same model in and out (e.g. AtomicRule): the LLM returns verbatim strings; this step links them to document spans. If rules look wrong, inspect the LLM step; if quotes won't click, inspect this step.";

function llmEmitsQuotes(m: PipelineModule, models: StructureModel[]): boolean {
  if (!isLlmKind(m.kind) || !m.outStructureId) return false;
  const out = models.find((x) => x.id === m.outStructureId);
  return !!out && hasQuoteField(out, models);
}

export function isAutoQuoteStep(m: PipelineModule): boolean {
  return (
    m.kind === "quote" &&
    (m.auto === true || m.id.startsWith("mod_quote_") || m.id === "mod_link_quotes")
  );
}

function existingQuoteForLlm(modules: PipelineModule[], llmId: ModuleId): PipelineModule | undefined {
  const i = modules.findIndex((m) => m.id === llmId);
  if (i < 0) return undefined;
  const next = modules[i + 1];
  if (next?.kind === "quote" && isAutoQuoteStep(next)) return next;
  return modules.find((m) => m.id === (`mod_quote_${llmId}` as ModuleId));
}

function modulesEqual(a: PipelineModule[], b: PipelineModule[]): boolean {
  return a.length === b.length && a.every((m, i) => m === b[i] || JSON.stringify(m) === JSON.stringify(b[i]));
}

// AI : move assert steps to immediately after the latest referenced step label (by pipeline order).
export function syncAssertPlacement(modules: PipelineModule[]): PipelineModule[] {
  const asserts = modules.filter((m) => m.kind === "assert");
  if (!asserts.length) return modules;

  const spine = modules.filter((m) => m.kind !== "assert");
  const placed: PipelineModule[] = [...spine];

  for (const a of asserts) {
    const code = assertEntriesForModule(a).map((e) => e.code).join("\n");
    const labels = parseAssertReferencedLabels(code);
    let insertAfter = -1;
    for (const label of labels) {
      const idx = placed.findIndex((m) => m.label === label);
      if (idx > insertAfter) insertAfter = idx;
    }
    if (insertAfter < 0) insertAfter = placed.length - 1;

    const upstream = placed[insertAfter];
    const emits = stepEmits(upstream);
    const fixed: PipelineModule = {
      ...a,
      inStructureId: emits ?? a.inStructureId,
      outStructureId: emits ?? a.outStructureId ?? a.inStructureId,
    };
    const existingIdx = placed.findIndex((m) => m.id === a.id);
    if (existingIdx >= 0) placed.splice(existingIdx, 1);
    placed.splice(insertAfter + 1, 0, fixed);
  }

  return modulesEqual(modules, placed) ? modules : placed;
}

// AI : strip managed Link Quotes steps and re-insert immediately after each quote-emitting LLM.
export function syncAutoQuoteSteps(
  modules: PipelineModule[],
  models: StructureModel[],
): PipelineModule[] {
  const stripped = modules.filter((m) => !isAutoQuoteStep(m));
  const out: PipelineModule[] = [];

  for (const m of stripped) {
    out.push(m);
    if (!llmEmitsQuotes(m, models) || !m.outStructureId) continue;
    const outModel = models.find((x) => x.id === m.outStructureId)!;
    const existing = existingQuoteForLlm(modules, m.id);
    out.push({
      id: (existing?.id ?? (`mod_quote_${m.id}` as ModuleId)) as ModuleId,
      kind: "quote",
      label: "Link Quotes",
      auto: true,
      note: `Auto · ${outModel.name} → ${outModel.name} · links LLM quote strings to source spans.`,
      inStructureId: m.outStructureId,
      outStructureId: m.outStructureId,
      outIsList: !!m.outIsList || m.kind === "llm-batch",
      cached: true,
      avgMs: existing?.avgMs ?? 12,
      avgCostCents: 0,
    });
  }

  return modulesEqual(modules, out) ? modules : out;
}

export function migrateProjectModules(project: Project): Project {
  const models = withSharedModels(stripSharedModels(project.models));
  const quoted = syncAutoQuoteSteps(project.modules, models);
  const placed = syncAssertPlacement(quoted);
  const migrated = placed.map(migrateCustomCodeModule);
  // AI : cache is always on — normalize legacy projects that disabled it per step.
  const withCache = migrated.map((m) => (m.cached ? m : { ...m, cached: true }));
  const modelsChanged = models.length !== project.models.length || models.some((m, i) => m !== project.models[i]);
  const changed =
    modelsChanged ||
    placed !== project.modules ||
    migrated.some((m, i) => m !== placed[i]) ||
    withCache.some((m, i) => m !== migrated[i]);
  if (!changed) return project;
  return { ...project, models, modules: withCache };
}
