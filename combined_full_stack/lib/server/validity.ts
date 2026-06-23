import type {
  ModuleId,
  ModuleKind,
  PipelineModule,
  Project,
  StructureModel,
  StructureModelId,
} from "./types";
import { hasQuoteField, listFieldsForWrap } from "./structure";

export type InvalidKind = "io-mismatch" | "no-output" | "transform-list-wrap";

export interface InvalidStep {
  moduleId: ModuleId;
  kind: InvalidKind;
  expects?: StructureModelId;
  upstreamEmits?: StructureModelId;
}

export interface PipelineWarning {
  moduleId: ModuleId;
  kind: "no-prompt" | "quote-no-fields" | "unused-output" | "transform-multi-list";
}

const LLM_KINDS: ModuleKind[] = ["llm", "llm-batch"];

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
  if (m.kind === "output") return m.inStructureId ?? m.outStructureId;
  return m.outStructureId;
}

// AI : canonical I/O-validity check — strictly linear except combine (pipeline state + side doc).
// AI : invalid = missing output model, or inStructureId ≠ previous step's emitted structure.
export function computeInvalid(modules: PipelineModule[], models: StructureModel[] = []): Map<ModuleId, InvalidStep> {
  const invalid = new Map<ModuleId, InvalidStep>();
  for (const m of modules) {
    // AI : output steps only need inStructureId — they pass it through as a named artifact.
    if (m.kind === "output") {
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

    if (m.kind === "output") {
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
    if (LLM_KINDS.includes(m.kind) && !m.prompt?.trim()) {
      warnings.set(m.id, { moduleId: m.id, kind: "no-prompt" });
    }
    if (m.kind === "quote" && !isAutoQuoteStep(m) && m.outStructureId) {
      const out = models.find((x) => x.id === m.outStructureId);
      if (out && !hasQuoteField(out)) {
        warnings.set(m.id, { moduleId: m.id, kind: "quote-no-fields" });
      }
    }
    const emitted = stepEmits(m);
    if (!emitted || m.kind === "input" || m.kind === "output") continue;
    const used = modules.slice(i + 1).some((down) => down.inStructureId === emitted);
    if (!used) warnings.set(m.id, { moduleId: m.id, kind: "unused-output" });

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
  if (issue.kind === "unused-output") {
    const m = modules.find((x) => x.id === issue.moduleId);
    const name = modelName(models, stepEmits(m)) ?? "output";
    return `${name} is never consumed by a downstream step`;
  }
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

export function invalidStepMessage(
  issue: InvalidStep,
  models: StructureModel[],
  modules: PipelineModule[],
): string {
  if (issue.kind === "no-output") {
    const m = modules.find((x) => x.id === issue.moduleId);
    return m?.kind === "output" ? "select a structure to materialize" : "select an output model";
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
  return "invalid step";
}

// AI : A/B strategies use the pipeline's own LLM prompt — not a hardcoded legal brief.
export function pipelineTaskPrompt(modules: PipelineModule[]): string {
  const outMod = [...modules].reverse().find((m) => m.kind === "output");
  const targetId = outMod?.inStructureId;
  if (targetId) {
    const direct = modules.find(
      (m) => LLM_KINDS.includes(m.kind) && m.outStructureId === targetId && m.prompt?.trim(),
    );
    if (direct?.prompt) return direct.prompt.trim();
  }
  const withPrompt = modules.filter((m) => LLM_KINDS.includes(m.kind) && m.prompt?.trim());
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
  if (!LLM_KINDS.includes(m.kind) || !m.outStructureId) return false;
  const out = models.find((x) => x.id === m.outStructureId);
  return !!out && hasQuoteField(out);
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
      cached: existing?.cached ?? true,
      avgMs: existing?.avgMs ?? 12,
      avgCostCents: 0,
    });
  }

  return modulesEqual(modules, out) ? modules : out;
}

// AI : alias — store migration and server init use the same sync.
export const insertMissingQuoteSteps = syncAutoQuoteSteps;

export function migrateProjectModules(project: Project): Project {
  const modules = syncAutoQuoteSteps(project.modules, project.models);
  return modules === project.modules ? project : { ...project, modules };
}
