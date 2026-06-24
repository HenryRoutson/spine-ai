import type { PipelineModule, StructureModel } from "./types";
import type { PipelineState, StepLabel } from "../run-types";

export type { PipelineState, StepLabel };

// AI : TODO(spec) — implementation checklist (order matters):
// AI : 1. validity.ts — unique non-empty labels (duplicate-label / empty-label) ✓ wired in computeInvalid
// AI : 2. run_engine RunCtx — add `byLabel: PipelineState`; after each step `byLabel[m.label] = result.value`
// AI : 3. implicit combine — drop `combine` kind; second+ `input` steps only write `byLabel[label]` (no auto EvaluationInput struct)
// AI : 4. migrate seeds (legal, db_migration) — remove combine modules + auto structures; rename labels to match desired keys
// AI : 5. LLM steps — build prompt context from `byLabel` (all prior labels or a declared dependency subset on the module)
// AI : 6. custom-code / transform — signature `(input, state: PipelineState) => output`; thread state through ClientStepPendingError + checkpoint + run-engine client poll
// AI : 7. structure.ts — `pipelineStateSchema(project)` generates a zod type for the label-keyed object (for editor hints + runtime validate)
// AI : 8. validity — derive step dependencies (inStructureId, prompt refs, optional explicit `usesLabels[]`); warn on unused labels / disconnected subgraph
// AI : 9. DAG scheduler — topological sort on dependencies; parallel batch where independent; UI toggle for execution-order view
// AI : 10. pipeline-layout.ts — delete combine segments once implicit combine ships; simplify segmentPipeline / combinePairIds
// AI : 11. cache keys — include byLabel fingerprint slice for steps that read multiple prior labels
// AI : 12. logging / inference mirror — show which labels each step consumed (dependency arrows on canvas)

export function emptyPipelineState(): PipelineState {
  return {};
}

// AI : TODO(spec) — optional slug helper if we ever need python-safe keys; spec uses human labels verbatim for now.
export function labelAsStateKey(label: string): StepLabel {
  return label.trim();
}

export function labelsForModules(modules: PipelineModule[]): StepLabel[] {
  return modules.map((m) => labelAsStateKey(m.label)).filter(Boolean);
}

// AI : TODO(spec) — build the zod schema for the full label-keyed state from modules + StructureModel[].
export function pipelineStateSchema(_project: {
  modules: PipelineModule[];
  models: StructureModel[];
}): unknown {
  throw new Error("pipelineStateSchema not implemented — see pipeline_state.ts TODO(spec)");
}
