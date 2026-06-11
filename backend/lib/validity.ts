import type { ModuleId, PipelineModule, StructureModel, StructureModelId } from "./types.js";

export interface InvalidStep {
  moduleId: ModuleId;
  expects?: StructureModelId;
  upstreamEmits?: StructureModelId;
}

// AI : canonical I/O-validity check — mirrors the frontend `computeInvalid`.
// AI : a step is invalid when the previous step's output model != this step's input model.
// AI : `input` sources its own data and `combine` intentionally reshapes, so both are exempt.
export function computeInvalid(modules: PipelineModule[]): Map<ModuleId, InvalidStep> {
  const invalid = new Map<ModuleId, InvalidStep>();
  for (let i = 1; i < modules.length; i++) {
    const prev = modules[i - 1];
    const cur = modules[i];
    if (cur.kind === "input") continue;
    if (!cur.inStructureId) continue;
    const upstream = prev.outStructureId;
    if (upstream && cur.inStructureId && upstream !== cur.inStructureId && cur.kind !== "combine") {
      invalid.set(cur.id, { moduleId: cur.id, expects: cur.inStructureId, upstreamEmits: upstream });
    }
  }
  return invalid;
}

export function isPipelineValid(modules: PipelineModule[]): boolean {
  return computeInvalid(modules).size === 0;
}

// AI : a step's run button is enabled only when the pipeline is valid AND the step is
// AI : cached or has an input ready (demo_outline: "run button on each step which has a cached or input").
export function canRunStep(modules: PipelineModule[], moduleId: ModuleId, hasInput: boolean): boolean {
  if (!isPipelineValid(modules)) return false;
  const m = modules.find((x) => x.id === moduleId);
  if (!m) return false;
  return m.cached || m.kind === "input" || hasInput;
}

export function modelName(models: StructureModel[], id?: StructureModelId): string | undefined {
  return models.find((m) => m.id === id)?.name;
}
