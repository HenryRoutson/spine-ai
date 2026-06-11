import { z, type ZodType } from "zod";
import type { FieldType, ModelField, StructureModel, StructureModelId } from "./types";

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
    // AI : optional ⇒ absent OR null — deterministic steps (db migration mapping) emit explicit
    // AI : nulls per spec; llmSchema keeps plain .optional() so models omit instead.
    shape[f.name] = f.optional ? base.nullish() : base;
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
// AI : the exact suffix appended to every structured LLM call (logging + OpenRouter).
export function structuredLlmPrompt(userPrompt: string, schema: ZodType): string {
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema), null, 2);
  return `${userPrompt}\n\nRespond with ONLY a JSON value that validates against this JSON Schema:\n${jsonSchema}`;
}

// AI : JSON Schema preview for the pipeline inspector (Zod llmSchema → JSON Schema).
export function llmSchemaJson(model: StructureModel, models: StructureModel[], isList: boolean): string {
  return JSON.stringify(z.toJSONSchema(llmSchema(model, models, isList)), null, 2);
}

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

// AI : hints when coercing loose step output (doc text, labels) into a declared StructureModel.
export interface MaterializeHints {
  docId?: string;
  label?: string;
  note?: string;
  sourceText?: string;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function defaultTextForField(
  field: ModelField,
  hints: MaterializeHints,
  body: string,
  purpose: string,
): string {
  if (field.name === "body") return body;
  if (field.name === "purpose") return purpose;
  return "";
}

function coerceFieldValue(
  val: unknown,
  field: ModelField,
  models: StructureModel[],
  hints: MaterializeHints,
  body: string,
  purpose: string,
  docId: string,
): unknown {
  if (val !== undefined && val !== null) {
    if (field.type === "model" && field.ref) {
      const ref = models.find((m) => m.id === field.ref);
      if (ref) return materializeToModel(val, ref, models, hints);
    }
    if (field.type === "list[model]" && field.ref && Array.isArray(val)) {
      const ref = models.find((m) => m.id === field.ref);
      if (ref) return val.map((item) => materializeToModel(item, ref, models, hints));
    }
    return val;
  }
  switch (field.type) {
    case "text":
      return defaultTextForField(field, hints, body, purpose);
    case "int":
      return 0;
    case "float":
      return 0;
    case "bool":
      return false;
    case "datetime":
      return "";
    case "document":
      return { doc_id: docId, purpose, body };
    case "list[text]":
      return [];
    case "tuple[text,quote]":
      return "";
    case "list[tuple[text,quote]]":
      return [];
    case "model":
      if (!field.ref) return {};
      const ref = models.find((m) => m.id === field.ref);
      return ref ? materializeToModel({}, ref, models, hints) : {};
    case "list[model]":
      return [];
  }
}

// AI : map loose runtime values (file text, doc_id) into every field of a pydantic/zod StructureModel.
export function materializeToModel(
  partial: unknown,
  model: StructureModel,
  models: StructureModel[] = [],
  hints: MaterializeHints = {},
): Record<string, unknown> {
  const raw = asRecord(partial);
  const body =
    typeof raw.body === "string"
      ? raw.body
      : hints.sourceText ?? (typeof partial === "string" ? partial : "");
  const purpose =
    typeof raw.purpose === "string" && raw.purpose.trim()
      ? raw.purpose.trim()
      : hints.note?.trim() ||
        hints.label?.trim() ||
        body.split("\n").find((l) => l.trim())?.trim() ||
        "Document";
  const docId = typeof raw.doc_id === "string" ? raw.doc_id : hints.docId ?? "";

  const out: Record<string, unknown> = {};
  for (const f of model.fields) {
    out[f.name] = coerceFieldValue(raw[f.name], f, models, hints, body, purpose, docId);
  }
  return out;
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
