import type {
  ModuleId,
  ModuleKind,
  PipelineModule,
  Project,
  StructureModel,
  StructureModelId,
} from "./types";
import { migrateCustomCodeModule } from "@/lib/custom_code_entries";
import { assertEntriesForModule, parseAssertReferencedLabels } from "@/lib/assert_steps";
import { hasQuoteField, listFieldsForWrap } from "./structure";
import { isLlmKind } from "@/lib/module-kinds";

export type InvalidKind =
  | "io-mismatch"
  | "no-output"
  | "transform-list-wrap"
  | "empty-label"
  | "duplicate-label"
  | "unused-output"
  | "duplicate-input-struct"
  | "duplicate-output-struct";

export interface InvalidStep {
  moduleId: ModuleId;
  kind: InvalidKind;
  expects?: StructureModelId;
  upstreamEmits?: StructureModelId;
}

export interface PipelineWarning {
  moduleId: ModuleId;
  kind: "no-prompt" | "quote-no-fields" | "transform-multi-list";
}

// AI : mirrors run_engine transform — llm-batch and outIsList steps put a bare array on the spine.
export function stepEmitsList(m: PipelineModule | undefined): boolean {
  if (!m) return false;
  if (m.kind === "llm-batch") return true;
  return !!m.outIsList;
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

// AI : what structure a step puts on the linear spine for the *next* step (output passthrough).
export function stepEmits(m: PipelineModule | undefined): StructureModelId | undefined {
  if (!m) return undefined;
  if (m.kind === "output" || m.kind === "assert") return m.inStructureId ?? m.outStructureId;
  return m.outStructureId;
}

// AI : canonical pipeline validation — I/O linearity (today), unique labels (spec), future dependency graph.
// AI : spec vision: labels key PipelineState (lib/server/pipeline_state.ts); see TODO(spec) there.
function computeLabelInvalid(modules: PipelineModule[]): Map<ModuleId, InvalidStep> {
  const invalid = new Map<ModuleId, InvalidStep>();
  const byLabel = new Map<string, ModuleId[]>();
  for (const m of modules) {
    const label = m.label.trim();
    if (!label) {
      invalid.set(m.id, { moduleId: m.id, kind: "empty-label" });
      continue;
    }
    const ids = byLabel.get(label) ?? [];
    ids.push(m.id);
    byLabel.set(label, ids);
  }
  for (const ids of byLabel.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) invalid.set(id, { moduleId: id, kind: "duplicate-label" });
  }
  return invalid;
}

// AI : canonical I/O-validity check — strictly linear except combine (pipeline state + side doc).
// AI : invalid = missing output model, or inStructureId ≠ previous step's emitted structure.
export function computeInvalid(modules: PipelineModule[], models: StructureModel[] = []): Map<ModuleId, InvalidStep> {
  const invalid = computeLabelInvalid(modules);
  for (const m of modules) {
    // AI : output steps only need inStructureId — they pass it through as a named artifact.
    if (m.kind === "output" || m.kind === "assert") {
      if (!m.inStructureId) invalid.set(m.id, { moduleId: m.id, kind: "no-output" });
      continue;
    }
    if (!m.outStructureId) invalid.set(m.id, { moduleId: m.id, kind: "no-output" });
  }

  let flow: StructureModelId | undefined;
  const byModel = new Set<StructureModelId>();

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    const prev = i > 0 ? modules[i - 1] : undefined;

    if (m.kind === "input") {
      if (modules[i + 1]?.kind === "combine") continue;
      if (m.outStructureId) {
        flow = m.outStructureId;
        byModel.add(m.outStructureId);
      }
      continue;
    }

    if (m.kind === "combine") {
      if (m.inStructureId && !byModel.has(m.inStructureId)) {
        invalid.set(m.id, {
          moduleId: m.id,
          kind: "io-mismatch",
          expects: m.inStructureId,
          upstreamEmits: flow ?? prev?.outStructureId,
        });
      }
      if (m.outStructureId) {
        flow = m.outStructureId;
        byModel.add(m.outStructureId);
      }
      continue;
    }

    if (m.kind === "output" || m.kind === "assert") {
      if (invalid.has(m.id)) continue;
      const upstream = stepEmits(prev) ?? flow;
      if (!m.inStructureId || upstream !== m.inStructureId) {
        invalid.set(m.id, {
          moduleId: m.id,
          kind: "io-mismatch",
          expects: m.inStructureId,
          upstreamEmits: upstream,
        });
      } else if (m.inStructureId) {
        flow = m.inStructureId;
      }
      continue;
    }

    if (!m.inStructureId || invalid.has(m.id)) continue;

    const upstream = stepEmits(prev) ?? flow;
    if (upstream !== m.inStructureId) {
      invalid.set(m.id, {
        moduleId: m.id,
        kind: "io-mismatch",
        expects: m.inStructureId,
        upstreamEmits: upstream,
      });
      continue;
    }

    if (m.outStructureId) {
      flow = m.outStructureId;
      byModel.add(m.outStructureId);
    }

    const transformIssue = transformListWrapInvalid(m, prev, models);
    if (transformIssue) invalid.set(m.id, transformIssue);
  }

  for (const [id, issue] of computeUnusedOutputInvalid(modules)) {
    if (!invalid.has(id)) invalid.set(id, issue);
  }
  for (const [id, issue] of computeDuplicateIoStructInvalid(modules)) {
    if (!invalid.has(id)) invalid.set(id, issue);
  }

  return invalid;
}

// AI : middle steps must feed a downstream inStructureId (combine counts via inStructureId).
function computeUnusedOutputInvalid(modules: PipelineModule[]): Map<ModuleId, InvalidStep> {
  const invalid = new Map<ModuleId, InvalidStep>();
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    const emitted = stepEmits(m);
    if (!emitted || m.kind === "input" || m.kind === "output" || m.kind === "assert") continue;
    const used = modules.slice(i + 1).some((down) => down.inStructureId === emitted);
    if (!used) invalid.set(m.id, { moduleId: m.id, kind: "unused-output", expects: emitted });
  }
  return invalid;
}

// AI : shared input struct is ok when the repeat sits directly before combine (side document).
function computeDuplicateIoStructInvalid(modules: PipelineModule[]): Map<ModuleId, InvalidStep> {
  const invalid = new Map<ModuleId, InvalidStep>();
  const spineInputStructs = new Set<StructureModelId>();
  const outputByStruct = new Map<StructureModelId, ModuleId[]>();

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    if (m.kind === "input" && m.outStructureId) {
      const beforeCombine = modules[i + 1]?.kind === "combine";
      if (beforeCombine) continue;
      if (spineInputStructs.has(m.outStructureId)) {
        invalid.set(m.id, { moduleId: m.id, kind: "duplicate-input-struct", expects: m.outStructureId });
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
    for (const id of ids) invalid.set(id, { moduleId: id, kind: "duplicate-output-struct" });
  }

  return invalid;
}

// AI : warnings don't block runs — empty LLM prompts fall back at runtime but should be visible.
export function computeWarnings(
  modules: PipelineModule[],
  models: StructureModel[] = [],
): Map<ModuleId, PipelineWarning> {
  const warnings = new Map<ModuleId, PipelineWarning>();
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    if (isLlmKind(m.kind) && !m.prompt?.trim()) {
      warnings.set(m.id, { moduleId: m.id, kind: "no-prompt" });
    }
    if (m.kind === "quote" && !isAutoQuoteStep(m) && m.outStructureId) {
      const out = models.find((x) => x.id === m.outStructureId);
      if (out && !hasQuoteField(out, models)) {
        warnings.set(m.id, { moduleId: m.id, kind: "quote-no-fields" });
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
        warnings.set(m.id, { moduleId: m.id, kind: "transform-multi-list" });
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
  if (issue.kind === "quote-no-fields") return "output model has no quote fields";
  if (issue.kind === "transform-multi-list") {
    const m = modules.find((x) => x.id === issue.moduleId);
    const name = modelName(models, m?.outStructureId) ?? "output";
    return `upstream list → ${name} only auto-unwraps one item — add a list field or custom TS if batch size may exceed 1`;
  }
  return "warning";
}

// AI : human-readable validation report for assistants and retry prompts.
export function formatPipelineValidationErrors(
  modules: PipelineModule[],
  models: StructureModel[] = [],
): string {
  const invalid = computeInvalid(modules, models);
  if (invalid.size === 0) return "";
  const lines: string[] = [];
  for (const issue of invalid.values()) {
    const step = modules.find((m) => m.id === issue.moduleId);
    const label = step?.label ?? issue.moduleId;
    const kind = step?.kind ?? "?";
    lines.push(`- "${label}" (${kind}): ${invalidStepMessage(issue, models, modules)}`);
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

// AI : red connector / upstream border — downstream step index carries the io-mismatch invalid flag.
export function ioMismatchAtModuleIndex(
  modules: PipelineModule[],
  invalid: Map<ModuleId, InvalidStep> | undefined,
  moduleIndex: number,
): boolean {
  if (!invalid || moduleIndex < 0 || moduleIndex >= modules.length) return false;
  const issue = invalid.get(modules[moduleIndex]!.id);
  return issue?.kind === "io-mismatch";
}

export function ioMismatchUpstreamOf(
  moduleId: ModuleId,
  modules: PipelineModule[],
  invalid: Map<ModuleId, InvalidStep> | undefined,
): boolean {
  if (!invalid) return false;
  for (const [downId, issue] of invalid) {
    if (issue.kind !== "io-mismatch") continue;
    if (prevModuleId(modules, downId) === moduleId) return true;
  }
  return false;
}

export function stepIoMismatchLinked(
  moduleId: ModuleId,
  modules: PipelineModule[],
  invalid: Map<ModuleId, InvalidStep> | undefined,
): boolean {
  if (!invalid) return false;
  const issue = invalid.get(moduleId);
  if (issue?.kind === "io-mismatch") return true;
  return ioMismatchUpstreamOf(moduleId, modules, invalid);
}

// AI : one inspector fix per step — downstream gets adopt-upstream, upstream gets align-upstream.
export function ioMismatchInspectorFix(
  moduleId: ModuleId,
  modules: PipelineModule[],
  invalid: Map<ModuleId, InvalidStep>,
  models: StructureModel[],
): IoMismatchInspectorFix | undefined {
  const own = invalid.get(moduleId);
  if (own?.kind === "io-mismatch") {
    const adopt = ioMismatchFixHints(own, models)?.find((h) => h.kind === "adopt-upstream");
    if (!adopt) return undefined;
    return {
      mismatchModuleId: moduleId,
      kind: "adopt-upstream",
      label: adopt.label,
      message: `input expects ${modelName(models, own.expects)}, upstream emits ${
        modelName(models, own.upstreamEmits) ?? "?"
      }`,
    };
  }

  for (const [downId, issue] of invalid) {
    if (issue.kind !== "io-mismatch" || prevModuleId(modules, downId) !== moduleId) continue;
    const align = ioMismatchFixHints(issue, models)?.find((h) => h.kind === "align-upstream");
    if (!align) continue;
    return {
      mismatchModuleId: downId,
      kind: "align-upstream",
      label: align.label,
      message: `downstream expects ${modelName(models, issue.expects)}, this step emits ${
        modelName(models, issue.upstreamEmits) ?? "?"
      }`,
    };
  }

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
    return `input expects ${modelName(models, issue.expects)}, upstream emits ${
      modelName(models, issue.upstreamEmits) ?? "?"
    }`;
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

// AI : alias — store migration and server init use the same sync.
export const insertMissingQuoteSteps = syncAutoQuoteSteps;

export function migrateProjectModules(project: Project): Project {
  const quoted = syncAutoQuoteSteps(project.modules, project.models);
  const placed = syncAssertPlacement(quoted);
  const migrated = placed.map(migrateCustomCodeModule);
  // AI : cache is always on — normalize legacy projects that disabled it per step.
  const withCache = migrated.map((m) => (m.cached ? m : { ...m, cached: true }));
  const changed =
    placed !== project.modules ||
    migrated.some((m, i) => m !== placed[i]) ||
    withCache.some((m, i) => m !== migrated[i]);
  if (!changed) return project;
  return { ...project, modules: withCache };
}
