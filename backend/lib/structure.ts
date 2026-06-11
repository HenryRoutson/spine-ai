import { z, type ZodType } from "zod";
import type { FieldType, ModelField, StructureModel, StructureModelId } from "./types.js";

// AI : the Quote shape mirrors the pydantic `Quote` class — links extracted text to a source span.
export const QuoteSchema = z.object({
  doc_id: z.string(),
  start: z.number().int(),
  end: z.number().int(),
});

// AI : tuple[text,quote] is modelled as an object (LLM-friendly) of { text, quote }.
const TextQuoteSchema = z.object({ text: z.string(), quote: QuoteSchema });

// AI : the prebuilt Document base (matches pydantic Document).
const DocumentSchema = z.object({ doc_id: z.string(), purpose: z.string(), body: z.string() });

function byId(models: StructureModel[]): Map<StructureModelId, StructureModel> {
  return new Map(models.map((m) => [m.id, m]));
}

function leafSchema(
  type: FieldType,
  ref: StructureModelId | undefined,
  index: Map<StructureModelId, StructureModel>,
  seen: Set<StructureModelId>,
): ZodType {
  switch (type) {
    case "text":
      return z.string();
    case "int":
      return z.number().int();
    case "float":
      return z.number();
    case "bool":
      return z.boolean();
    case "datetime":
      return z.string(); // ISO-8601 string for JSON transport
    case "document":
      return DocumentSchema;
    case "list[text]":
      return z.array(z.string());
    case "tuple[text,quote]":
      return TextQuoteSchema;
    case "list[tuple[text,quote]]":
      return z.array(TextQuoteSchema);
    case "model":
      return refSchema(ref, index, seen);
    case "list[model]":
      return z.array(refSchema(ref, index, seen));
  }
}

function refSchema(
  ref: StructureModelId | undefined,
  index: Map<StructureModelId, StructureModel>,
  seen: Set<StructureModelId>,
): ZodType {
  const model = ref ? index.get(ref) : undefined;
  if (!model) return z.record(z.string(), z.unknown());
  return build(model, index, seen);
}

function build(
  model: StructureModel,
  index: Map<StructureModelId, StructureModel>,
  seen: Set<StructureModelId>,
): ZodType {
  // AI : guard against self/cyclic refs (the linear demo has none, but be safe).
  if (seen.has(model.id)) return z.record(z.string(), z.unknown());
  const next = new Set(seen).add(model.id);
  const shape: Record<string, ZodType> = {};
  for (const f of model.fields) {
    const base = leafSchema(f.type, f.ref, index, next);
    shape[f.name] = f.optional ? base.optional() : base;
  }
  return z.object(shape);
}

// AI : canonical schema builder — ONE definition backs runtime validation AND llm output schemas.
export function zodFromModel(model: StructureModel, models: StructureModel[] = []): ZodType {
  return build(model, byId(models), new Set());
}

// AI : true when a model carries a quote field — those need offset resolution after the LLM call.
export function hasQuoteField(model: StructureModel): boolean {
  return model.fields.some((f) => f.type === "tuple[text,quote]" || f.type === "list[tuple[text,quote]]");
}

// AI : LLM-facing schema — the model can't know byte offsets, so quote fields collapse to a plain
// AI : string (the verbatim quote). run-engine resolves those strings into {text, quote:{...}} after.
// AI : TODO bug — only TOP-LEVEL quote fields collapse; a quote field inside a nested
// AI : model/list[model] ref keeps the full {text, quote:{doc_id,start,end}} shape, asking the
// AI : LLM for byte offsets it cannot know. Latent: the seed never nests a quote-carrying model
// AI : under an llm step's output, but any user structure that does will fail validation.
export function llmSchema(model: StructureModel, models: StructureModel[], isList: boolean): ZodType {
  const index = byId(models);
  const shape: Record<string, ZodType> = {};
  for (const f of model.fields) {
    let base: ZodType;
    if (f.type === "tuple[text,quote]") base = z.string();
    else if (f.type === "list[tuple[text,quote]]") base = z.array(z.string());
    else base = leafSchema(f.type, f.ref, index, new Set([model.id]));
    shape[f.name] = f.optional ? base.optional() : base;
  }
  const obj = z.object(shape);
  return isList ? z.array(obj) : obj;
}

export interface ValidationResult<T = unknown> {
  ok: boolean;
  value?: T;
  error?: string;
}

// AI : implicit validation reused by Pipeline/Inference on every step's I/O (no standalone step).
export function validate(value: unknown, model: StructureModel, models: StructureModel[] = []): ValidationResult {
  const parsed = zodFromModel(model, models).safeParse(value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: parsed.error.toString() };
}

// ---- CRUD helpers (operate on a model list; persistence lives in store.ts) ----

export function upsertModel(models: StructureModel[], model: StructureModel): StructureModel[] {
  const i = models.findIndex((m) => m.id === model.id);
  if (i === -1) return [...models, model];
  return models.map((m) => (m.id === model.id ? model : m));
}

export function removeModel(models: StructureModel[], id: StructureModelId): StructureModel[] {
  return models.filter((m) => m.id !== id);
}

// AI : auto-structure (combine step / excel infer) — infer a StructureModel from a sample JSON value.
// AI : TODO placeholder beyond flat objects — nested inference is not built for the demo.
export function inferModel(sample: Record<string, unknown>, name: string, id: StructureModelId): StructureModel {
  const fields: ModelField[] = Object.entries(sample).map(([key, val], i) => ({
    id: `f_${i}`,
    name: key,
    type: inferType(val),
    optional: false,
    description: "",
  }));
  return { id, name, description: "Auto-generated structure.", auto: true, fields };
}

function inferType(val: unknown): FieldType {
  if (typeof val === "boolean") return "bool";
  if (typeof val === "number") return Number.isInteger(val) ? "int" : "float";
  if (Array.isArray(val)) return "list[text]";
  return "text";
}
