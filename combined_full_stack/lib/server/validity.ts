import type {
  ModuleId,
  ModuleKind,
  PipelineModule,
  Project,
  StructureModel,
  StructureModelId,
} from "./types";

export type InvalidKind = "io-mismatch" | "no-output";

export interface InvalidStep {
  moduleId: ModuleId;
  kind: InvalidKind;
  expects?: StructureModelId;
  upstreamEmits?: StructureModelId;
}

export interface PipelineWarning {
  moduleId: ModuleId;
  kind: "no-prompt";
}

const LLM_KINDS: ModuleKind[] = ["llm", "llm-batch"];

// AI : canonical I/O-validity check — mirrors the frontend `computeInvalid`.
// AI : invalid = missing output model, or previous step's output model != this step's input model.
// AI : `input` sources its own data and `combine` intentionally reshapes, so both are exempt from I/O mismatch.
export function computeInvalid(modules: PipelineModule[]): Map<ModuleId, InvalidStep> {
  const invalid = new Map<ModuleId, InvalidStep>();
  for (const m of modules) {
    if (!m.outStructureId) invalid.set(m.id, { moduleId: m.id, kind: "no-output" });
  }
  for (let i = 1; i < modules.length; i++) {
    const prev = modules[i - 1];
    const cur = modules[i];
    if (cur.kind === "input") continue;
    if (!cur.inStructureId) continue;
    const upstream = prev.outStructureId;
    if (upstream && cur.inStructureId && upstream !== cur.inStructureId && cur.kind !== "combine") {
      invalid.set(cur.id, {
        moduleId: cur.id,
        kind: "io-mismatch",
        expects: cur.inStructureId,
        upstreamEmits: upstream,
      });
    }
  }
  return invalid;
}

// AI : warnings don't block runs — empty LLM prompts fall back at runtime but should be visible.
export function computeWarnings(modules: PipelineModule[]): Map<ModuleId, PipelineWarning> {
  const warnings = new Map<ModuleId, PipelineWarning>();
  for (const m of modules) {
    if (LLM_KINDS.includes(m.kind) && !m.prompt?.trim()) {
      warnings.set(m.id, { moduleId: m.id, kind: "no-prompt" });
    }
  }
  return warnings;
}

export function invalidStepMessage(
  issue: InvalidStep,
  models: StructureModel[],
  modules: PipelineModule[],
): string {
  if (issue.kind === "no-output") return "select an output model";
  if (issue.kind === "io-mismatch") {
    const i = modules.findIndex((m) => m.id === issue.moduleId);
    return `input expects ${modelName(models, issue.expects)}, upstream emits ${
      modelName(models, modules[i - 1]?.outStructureId) ?? "?"
    }`;
  }
  return "invalid step";
}

// AI : A/B strategies use the pipeline's own LLM prompt — not a hardcoded legal brief.
export function pipelineTaskPrompt(modules: PipelineModule[]): string {
  const outMod = modules.find((m) => m.kind === "output");
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
  const outMod = project.modules.find((m) => m.kind === "output");
  if (!outMod?.inStructureId) throw new Error("pipeline has no output step with an output model");
  const m = project.models.find((x) => x.id === outMod.inStructureId);
  if (!m) throw new Error(`unknown output structure ${outMod.inStructureId}`);
  return m;
}

export function isPipelineValid(modules: PipelineModule[]): boolean {
  return computeInvalid(modules).size === 0;
}

// AI : a step's run button is enabled only when the pipeline is valid AND the step is
// AI : cached or has an input ready (demo_outline: "run button on each step which has a cached or input").
// AI : TODO bug — "cached" here is the m.cached CONFIG toggle, not whether a cache artifact
// AI : actually exists for the step's key (run_engine readCache); a cached:true step with no
// AI : cache file lights up with nothing to serve. Also: there is no per-step run entry point
// AI : in the engine at all — only the whole-pipeline runPipeline (demo_outline §2/§4).
export function canRunStep(modules: PipelineModule[], moduleId: ModuleId, hasInput: boolean): boolean {
  if (!isPipelineValid(modules)) return false;
  const m = modules.find((x) => x.id === moduleId);
  if (!m) return false;
  return m.cached || m.kind === "input" || hasInput;
}

export function modelName(models: StructureModel[], id?: StructureModelId): string | undefined {
  return models.find((m) => m.id === id)?.name;
}
