import { z, type ZodError, type ZodType } from "zod";
import { modelHasQuoteFields } from "./quote_schema";
import type { FieldType, ModelField, StructureModel, StructureModelId } from "./types";

function isListFieldType(type: FieldType): boolean {
  return type === "list[text]" || type === "list[model]" || type === "list[tuple[text,quote]]";
}

// AI : shared by run_engine wrap + pipeline validity — one definition for list-field detection.
export function listFieldsForWrap(model: StructureModel): ModelField[] {
  return model.fields.filter((f) => isListFieldType(f.type));
}

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

// AI : json field — string that must parse; prefer model / list[model] when shape is known
export function isValidJsonString(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

export function assertValidJsonFieldValue(val: unknown, fieldName?: string): asserts val is string {
  const label = fieldName ? `field "${fieldName}"` : "JSON field";
  if (typeof val !== "string") {
    throw new Error(`${label} must be a string containing serialized JSON`);
  }
  if (!isValidJsonString(val)) {
    throw new Error(`${label} must contain valid JSON`);
  }
}

const JsonStringSchema = z.string().refine(isValidJsonString, { message: "must be valid JSON" });

function byId(models: StructureModel[]): Map<StructureModelId, StructureModel> {
  return new Map(models.map((m) => [m.id, m]));
}

function fieldDescribe(f: ModelField): string | undefined {
  const parts: string[] = [];
  if (f.description.trim()) parts.push(f.description.trim());
  const ex = f.example?.trim();
  if (ex) parts.push(`Example: ${ex}`);
  return parts.length ? parts.join(" — ") : undefined;
}

function withFieldMeta(schema: ZodType, f: ModelField): ZodType {
  const d = fieldDescribe(f);
  return d ? schema.describe(d) : schema;
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
    case "json":
      return JsonStringSchema;
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
    default:
      // AI : corrupt/partial field types (UI draft state, legacy persisted data) — never leave undefined in z.object().
      return z.unknown();
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
    if (!f.name.trim()) continue;
    const base = withFieldMeta(leafSchema(f.type, f.ref, index, next), f);
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

// AI : true when this model or any nested ref carries a quote field — drives LLM source + link steps.
export function hasQuoteField(model: StructureModel, models: StructureModel[] = []): boolean {
  return modelHasQuoteFields(model, models.length ? models : [model]);
}

// AI : LLM-facing schema — quote fields collapse to plain strings at every nesting depth.
// AI : the exact suffix appended to every structured LLM call (logging + OpenRouter).
export function structuredLlmPrompt(userPrompt: string, schema: ZodType): string {
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema), null, 2);
  return `${userPrompt}\n\nRespond with ONLY a JSON value that validates against this JSON Schema:\n${jsonSchema}`;
}

// AI : JSON Schema preview for the pipeline inspector (Zod llmSchema → JSON Schema).
export function llmSchemaJson(model: StructureModel, models: StructureModel[], isList: boolean): string {
  return JSON.stringify(z.toJSONSchema(llmSchema(model, models, isList)), null, 2);
}

function llmRefSchema(
  ref: StructureModelId | undefined,
  index: Map<StructureModelId, StructureModel>,
  seen: Set<StructureModelId>,
): ZodType {
  const model = ref ? index.get(ref) : undefined;
  if (!model) return z.record(z.string(), z.unknown());
  return llmBuild(model, index, seen);
}

function llmLeafSchema(
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
      return z.string();
    case "document":
      return DocumentSchema;
    case "json":
      return JsonStringSchema;
    case "list[text]":
      return z.array(z.string());
    case "tuple[text,quote]":
      return z.string();
    case "list[tuple[text,quote]]":
      return z.array(z.string());
    case "model":
      return llmRefSchema(ref, index, seen);
    case "list[model]":
      return z.array(llmRefSchema(ref, index, seen));
    default:
      return z.unknown();
  }
}

function llmBuild(
  model: StructureModel,
  index: Map<StructureModelId, StructureModel>,
  seen: Set<StructureModelId>,
): ZodType {
  if (seen.has(model.id)) return z.record(z.string(), z.unknown());
  const next = new Set(seen).add(model.id);
  const shape: Record<string, ZodType> = {};
  for (const f of model.fields) {
    if (!f.name.trim()) continue;
    const base = withFieldMeta(llmLeafSchema(f.type, f.ref, index, next), f);
    shape[f.name] = f.optional ? base.optional() : base;
  }
  return z.object(shape);
}

export function llmSchema(model: StructureModel, models: StructureModel[], isList: boolean): ZodType {
  const index = byId(models);
  const obj = llmBuild(model, index, new Set());
  // AI : json_object mode returns a wrapper object — unwrap before validating the list.
  return isList ? z.preprocess(coerceLlmListOutput, z.array(obj)) : obj;
}

const LIST_WRAPPER_KEYS = ["items", "rules", "results", "data", "output", "records"] as const;

export function coerceLlmListOutput(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return value;
  const rec = value as Record<string, unknown>;
  for (const key of LIST_WRAPPER_KEYS) {
    if (Array.isArray(rec[key])) return rec[key];
  }
  const arrays = Object.values(rec).filter(Array.isArray);
  if (arrays.length === 1) return arrays[0];
  return value;
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
    case "json":
      return "[]";
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
    default:
      return null;
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

// AI : llm-batch emits a bare array; a single-object output needs that list in a list field.
export function wrapListForOutputStructure(
  list: unknown[],
  out: StructureModel,
  inStructureId?: StructureModelId,
): Record<string, unknown> {
  const listFields = listFieldsForWrap(out);
  if (listFields.length === 0) {
    throw new Error(
      `output structure "${out.name}" has no list field — add one or use custom-code to reshape the upstream list`,
    );
  }
  const matched =
    inStructureId &&
    listFields.find((f) => f.type === "list[model]" && f.ref === inStructureId);
  const target = matched ?? listFields[0];
  return { [target.name]: list };
}

// AI : zod issues as JSON — matches what Logging shows in the validation-errors box.
function formatZodError(error: ZodError): string {
  return JSON.stringify(error.issues, null, 2);
}

// AI : implicit validation reused by Pipeline/Inference on every step's I/O (no standalone step).
export function validate(value: unknown, model: StructureModel, models: StructureModel[] = []): ValidationResult {
  const parsed = zodFromModel(model, models).safeParse(value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: formatZodError(parsed.error) };
}

// AI : LLM steps emit plain quote strings; quote steps emit linked spans — pick the right schema.
export function validateStepOutput(
  value: unknown,
  model: StructureModel,
  models: StructureModel[],
  opts: { isList?: boolean; rawQuotes?: boolean } = {},
): ValidationResult {
  const isList = opts.isList ?? false;
  const itemSchema = opts.rawQuotes ? llmSchema(model, models, false) : zodFromModel(model, models);
  if (isList) {
    const parsed = z.array(itemSchema).safeParse(coerceLlmListOutput(value));
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, error: formatZodError(parsed.error) };
  }
  const parsed = itemSchema.safeParse(value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: formatZodError(parsed.error) };
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
  if (typeof val === "string" && isValidJsonString(val)) return "json";
  if (Array.isArray(val)) return "list[text]";
  return "text";
}
