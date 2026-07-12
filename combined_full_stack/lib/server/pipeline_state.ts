import { z, type ZodType } from "zod";
import type { PipelineModule, Project, StructureModel, TypeAlias } from "./types";
import type { PipelineState, StepLabel } from "../run-types";
import { formatTypeExpr, labelToPyKey, stepSpineOutType, typeExprToGo, typeExprToRust, typeExprToTs, typeExprToZod, zodFromModel } from "./type_expr";

export type { PipelineState, StepLabel };

export function emptyPipelineState(): PipelineState {
  return {};
}

export function labelAsStateKey(label: string): StepLabel {
  return label.trim();
}

export function labelsForModules(modules: PipelineModule[]): StepLabel[] {
  return modules.map((m) => labelAsStateKey(m.label)).filter(Boolean);
}

export type PipelineStateField = {
  label: StepLabel;
  moduleId: string;
  type: ReturnType<typeof stepSpineOutType>;
};

// AI : per-label output types for every step that writes pipeline state.
export function pipelineStateFields(project: {
  modules: PipelineModule[];
  models: StructureModel[];
}): PipelineStateField[] {
  const fields: PipelineStateField[] = [];
  for (const m of project.modules) {
    const label = labelAsStateKey(m.label);
    if (!label) continue;
    const spine = stepSpineOutType(m);
    if (!spine) continue;
    fields.push({ label, moduleId: m.id, type: spine });
  }
  return fields;
}

// AI : zod schema for the label-keyed pipeline state object.
export function pipelineStateSchema(project: {
  modules: PipelineModule[];
  models: StructureModel[];
  typeAliases?: TypeAlias[];
}): ZodType {
  const typeAliases = project.typeAliases ?? [];
  const shape: Record<string, ZodType> = {};
  for (const field of pipelineStateFields(project)) {
    if (!field.type) continue;
    shape[field.label] = typeExprToZod(field.type, project.models, new Set(), false, typeAliases);
  }
  return z.object(shape);
}

export function pipelineStatePyTypedDict(project: Project): string {
  const lines = pipelineStateFields(project).map((f) => {
    const key = labelToPyKey(f.label);
    const t = f.type ? formatTypeExpr(f.type, project.models) : "Any";
    return `    ${key}: ${t}  # "${f.label}"`;
  });
  if (!lines.length) return "class PipelineState(TypedDict):\n    pass\n";
  return `class PipelineState(TypedDict, total=False):\n${lines.join("\n")}\n`;
}

export function pipelineStateTsInterface(project: Project): string {
  const lines = pipelineStateFields(project).map((f) => {
    const t = f.type ? typeExprToTs(f.type, project.models) : "unknown";
    return `  ${JSON.stringify(f.label)}: ${t};`;
  });
  if (!lines.length) return "export type PipelineState = Record<string, never>;";
  return `export type PipelineState = {\n${lines.join("\n")}\n};`;
}

// AI : label-keyed HashMap — values as Value so heterogeneous step outputs type-check.
export function pipelineStateRustType(project: Project): string {
  const lines = pipelineStateFields(project).map((f) => {
    const t = f.type ? typeExprToRust(f.type, project.models) : "serde_json::Value";
    return `    // ${JSON.stringify(f.label)}: ${t}`;
  });
  const comment = lines.length ? `${lines.join("\n")}\n` : "";
  return [
    "// Pipeline state — step label → spine snapshot (JSON for open typing).",
    comment + "pub type PipelineState = HashMap<String, Value>;",
  ].join("\n");
}

// AI : label-keyed map — values as RawMessage so heterogeneous step outputs type-check.
export function pipelineStateGoType(project: Project): string {
  const lines = pipelineStateFields(project).map((f) => {
    const t = f.type ? typeExprToGo(f.type, project.models) : "json.RawMessage";
    return `// ${JSON.stringify(f.label)}: ${t}`;
  });
  const comment = lines.length ? `${lines.join("\n")}\n` : "";
  return [
    "// Pipeline state — step label → spine snapshot (JSON for open typing).",
    comment + "type PipelineState map[string]json.RawMessage",
  ].join("\n");
}

// AI : validate one label's stored value against its declared step output type.
export function validatePipelineStateEntry(
  label: StepLabel,
  value: unknown,
  project: Project,
): { ok: boolean; error?: string } {
  const field = pipelineStateFields(project).find((f) => f.label === label);
  if (!field?.type) return { ok: true };
  const typeAliases = project.typeAliases ?? [];
  const schema = typeExprToZod(field.type, project.models, new Set(), false, typeAliases);
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true };
  return { ok: false, error: JSON.stringify(parsed.error.issues, null, 2) };
}

// AI : optional — validate a full pipeline state snapshot.
export function validatePipelineState(
  state: PipelineState,
  project: Project,
): { ok: boolean; errors: { label: StepLabel; error: string }[] } {
  const schema = pipelineStateSchema(project);
  const parsed = schema.safeParse(state);
  if (parsed.success) return { ok: true, errors: [] };
  const errors = parsed.error.issues.map((issue) => ({
    label: String(issue.path[0] ?? "?"),
    error: issue.message,
  }));
  return { ok: false, errors };
}

export function modelZodFromProject(model: StructureModel, project: Project): ZodType {
  return zodFromModel(model, project.models);
}
