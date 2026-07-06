import { z, type ZodError, type ZodType } from "zod";
import { inferStructuresFromJson } from "@/lib/doc-structure-infer";
import { isValidJsonString } from "@/lib/json-utils";
import { isBuiltinDocumentModel } from "./builtin_models";
import { documentContentFrom, documentFilenameFrom, documentValueFrom } from "@/lib/server/document_value";
import { modelHasQuoteFields } from "./quote_schema";
import {
  fieldTypeToExpr,
  fieldToTypeExpr,
  fieldIsListType,
  formatTypeExpr,
  isListFieldType,
  typeExprToZod,
  withFieldMeta,
  zodFromModel as zodFromModelExpr,
} from "./type_expr";
import { inputModuleTypesAreAllJsonNative } from "@/lib/inference-input-core";
import { type FieldType, type ModelField, type PipelineModule, type StructureModel, type StructureModelId, type TypeAlias } from "./types";

export { QuoteSchema, isListFieldType } from "./type_expr";
export type { TypeExpr } from "./type_expr";
export {
  cardinalityMismatch,
  fieldTypeToExpr,
  fieldToTypeExpr,
  formatTypeExpr,
  stepEmitsList,
  stepSpineInType,
  stepSpineOutType,
  typeExprEqual,
  typeExprToPy,
  typeExprToTs,
} from "./type_expr";

export { isBuiltinDocumentModel } from "./builtin_models";

// AI : shared by run_engine wrap + pipeline validity — one definition for list-field detection.
export function listFieldsForWrap(model: StructureModel): ModelField[] {
  return model.fields.filter((f) => isListFieldType(f.type));
}

export { isValidJsonString } from "@/lib/json-utils";

export function assertValidJsonFieldValue(val: unknown, fieldName?: string): asserts val is string {
  const label = fieldName ? `field "${fieldName}"` : "JSON field";
  if (typeof val !== "string") {
    throw new Error(`${label} must be a string containing serialized JSON`);
  }
  if (!isValidJsonString(val)) {
    throw new Error(`${label} must contain valid JSON`);
  }
}

function llmModelToZod(
  model: StructureModel,
  models: StructureModel[],
  seen: Set<StructureModelId>,
  typeAliases: TypeAlias[] = [],
): ZodType {
  if (seen.has(model.id)) return z.record(z.string(), z.unknown());
  const next = new Set(seen).add(model.id);
  const shape: Record<string, ZodType> = {};
  for (const f of model.fields) {
    if (!f.name.trim()) continue;
    let base = withFieldMeta(
      typeExprToZod(fieldToTypeExpr(f), models, {
        seen: next,
        llmQuotes: true,
        typeAliases,
        seenAliasNames: new Set(),
      }),
      f,
    );
    if (f.minItems && f.minItems > 1 && fieldIsListType(f) && base instanceof z.ZodArray) {
      base = base.min(f.minItems);
    }
    shape[f.name] = f.optional ? base.optional() : base;
  }
  return z.object(shape);
}

// AI : canonical schema builder — ONE definition backs runtime validation AND llm output schemas.
export function zodFromModel(
  model: StructureModel,
  models: StructureModel[] = [],
  typeAliases: TypeAlias[] = [],
): ZodType {
  return zodFromModelExpr(model, models.length ? models : [model], false, typeAliases);
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
export function llmSchemaJson(
  model: StructureModel,
  models: StructureModel[],
  isList: boolean,
  typeAliases: TypeAlias[] = [],
): string {
  return JSON.stringify(z.toJSONSchema(llmSchema(model, models, isList, typeAliases)), null, 2);
}

function llmBuild(
  model: StructureModel,
  models: StructureModel[],
  seen: Set<StructureModelId>,
  typeAliases: TypeAlias[] = [],
): ZodType {
  return llmModelToZod(model, models, seen, typeAliases);
}

export function llmSchema(
  model: StructureModel,
  models: StructureModel[],
  isList: boolean,
  typeAliases: TypeAlias[] = [],
): ZodType {
  const obj = llmBuild(model, models, new Set(), typeAliases);
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
  docName?: string;
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
  content: string,
  purpose: string,
  filename: string,
): string {
  if (field.name === "content" || field.name === "body") return content;
  if (field.name === "filename") return filename;
  if (field.name === "purpose") return purpose;
  return "";
}

// AI : document fields accept {content,filename}, legacy {body,doc_id}, or structured rows → JSON text.
function documentFieldValue(val: unknown, hints: MaterializeHints): { content: string; filename: string } {
  const doc = documentValueFrom(val, hints);
  if (doc.content.trim()) return doc;
  if (val != null && typeof val === "object" && !Array.isArray(val)) {
    const serialized = JSON.stringify(val);
    if (serialized && serialized !== "{}") {
      return { content: serialized, filename: doc.filename || "document.json" };
    }
  }
  return doc;
}

function coerceFieldValue(
  val: unknown,
  field: ModelField,
  models: StructureModel[],
  hints: MaterializeHints,
  content: string,
  purpose: string,
  filename: string,
  docId: string,
): unknown {
  const expr = fieldToTypeExpr(field);
  if (val !== undefined && val !== null) {
    if (expr.kind === "ref") {
      const ref = models.find((m) => m.id === expr.modelId);
      if (ref) return materializeToModel(val, ref, models, hints);
    }
    if (expr.kind === "list" && Array.isArray(val)) {
      const item = expr.item;
      if (item.kind === "ref") {
        const ref = models.find((m) => m.id === item.modelId);
        if (ref) return val.map((row) => materializeToModel(row, ref, models, hints));
      }
    }
    if (expr.kind === "optional") {
      return coerceFieldValue(
        val,
        { ...field, typeExpr: expr.inner, optional: false },
        models,
        hints,
        content,
        purpose,
        filename,
        docId,
      );
    }
    if (field.type === "model" && field.ref) {
      const ref = models.find((m) => m.id === field.ref);
      if (ref) return materializeToModel(val, ref, models, hints);
    }
    if (field.type === "list[model]" && field.ref && Array.isArray(val)) {
      const ref = models.find((m) => m.id === field.ref);
      if (ref) return val.map((item) => materializeToModel(item, ref, models, hints));
    }
    if (expr.kind === "document" || field.type === "document") return documentFieldValue(val, hints);
    if (
      (expr.kind === "list" && expr.item.kind === "document") ||
      field.type === "list[document]"
    ) {
      if (Array.isArray(val)) return val.map((item) => documentFieldValue(item, hints));
    }
    return val;
  }
  switch (field.type) {
    case "text":
      return defaultTextForField(field, hints, content, purpose, filename);
    case "int":
      return 0;
    case "float":
      return 0;
    case "bool":
      return false;
    case "datetime":
      return "";
    case "document":
      return documentValueFrom(undefined, hints, content);
    case "list[document]":
      return [];
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

/** @deprecated use isBuiltinDocumentModel from builtin_models */
export const isSourceDocumentModel = isBuiltinDocumentModel;

// AI : input step — parse JSON file content into the declared I/O structure when all types are JSON-native.
export function materializeInputDocument(
  content: string,
  docId: string,
  m: PipelineModule,
  models: StructureModel[],
  hints: MaterializeHints = {},
): unknown {
  const out = models.find((x) => x.id === m.outStructureId);
  if (!out) return documentValueFrom(undefined, { docId, docName: hints.docName }, content);

  const docHints = { ...hints, docId, sourceText: content };

  if (inputModuleTypesAreAllJsonNative(m)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = undefined;
    }
    if (parsed !== undefined) {
      if (Array.isArray(parsed)) {
        const items = parsed.map((item) => materializeToModel(item, out, models, docHints));
        if (m.outIsList) return items;
        if (items.length === 1) return items[0]!;
        throw new Error(
          `input "${m.label}" JSON array has ${items.length} items but step expects a single ${out.name}`,
        );
      }
      const item = materializeToModel(parsed, out, models, docHints);
      return m.outIsList ? [item] : item;
    }
  }

  // AI : TODO bug — non-JSON text/pdf must stay Document until locked Parse-to-structure LLM runs;
  // AI : materializeToModel here coerces raw text into arbitrary struct fields (receipts pipeline).
  return materializeToModel(documentValueFrom({ content, filename: hints.docName ?? docId }, docHints, content), out, models, docHints);
}

// AI : map loose runtime values (file text, doc_id) into every field of a pydantic/zod StructureModel.
// AI : TODO bug — missing/wrong fields get silent defaults at run time; should fail in Structure tab / computeInvalid.
export function materializeToModel(
  partial: unknown,
  model: StructureModel,
  models: StructureModel[] = [],
  hints: MaterializeHints = {},
): Record<string, unknown> {
  const raw = asRecord(partial);
  const content = documentContentFrom(
    raw,
    hints.sourceText ?? (typeof partial === "string" ? partial : ""),
  );
  const purpose =
    typeof raw.purpose === "string" && raw.purpose.trim()
      ? raw.purpose.trim()
      : hints.docName?.trim() ||
        hints.note?.trim() ||
        hints.label?.trim() ||
        content.split("\n").find((line: string) => line.trim())?.trim() ||
        "Document";
  const filename = documentFilenameFrom(raw, hints, hints.docName ?? hints.docId ?? "document");
  const docId = typeof raw.doc_id === "string" ? raw.doc_id : hints.docId ?? "";

  const out: Record<string, unknown> = {};
  for (const f of model.fields) {
    out[f.name] = coerceFieldValue(raw[f.name], f, models, hints, content, purpose, filename, docId);
  }
  return out;
}

// AI : pick the list field a bare transform uses when wrapping list[T] → { …list field… }.
export function listFieldForAutoWrap(
  out: StructureModel,
  listItemStructureId: StructureModelId,
  inStructureId?: StructureModelId,
): ModelField | undefined {
  const listFields = listFieldsForWrap(out);
  if (!listFields.length) return undefined;
  if (inStructureId) {
    const byIn = listFields.find((f) => f.type === "list[model]" && f.ref === inStructureId);
    if (byIn) return byIn;
  }
  const byItem = listFields.find((f) => f.type === "list[model]" && f.ref === listItemStructureId);
  return byItem ?? listFields[0];
}

export function canAutoWrapListIntoOutputStructure(
  out: StructureModel,
  listItemStructureId: StructureModelId,
  inStructureId?: StructureModelId,
): boolean {
  return !!listFieldForAutoWrap(out, listItemStructureId, inStructureId);
}

// AI : llm-batch emits a bare array; a single-object output needs that list in a list field.
export function wrapListForOutputStructure(
  list: unknown[],
  out: StructureModel,
  inStructureId?: StructureModelId,
): Record<string, unknown> {
  const target = inStructureId
    ? listFieldForAutoWrap(out, inStructureId, inStructureId)
    : listFieldsForWrap(out)[0];
  if (!target) {
    throw new Error(
      `output structure "${out.name}" has no list field — add one or use custom-code to reshape the upstream list`,
    );
  }
  return { [target.name]: list };
}

// AI : zod issues as JSON — matches what Logging shows in the validation-errors box.
function formatZodError(error: ZodError): string {
  return JSON.stringify(error.issues, null, 2);
}

// AI : implicit validation reused by Pipeline/Inference on every step's I/O (no standalone step).
export function validate(
  value: unknown,
  model: StructureModel,
  models: StructureModel[] = [],
  typeAliases: TypeAlias[] = [],
): ValidationResult {
  const parsed = zodFromModel(model, models, typeAliases).safeParse(value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: formatZodError(parsed.error) };
}

// AI : LLM steps emit plain quote strings; quote steps emit linked spans — pick the right schema.
export function validateStepOutput(
  value: unknown,
  model: StructureModel,
  models: StructureModel[],
  opts: { isList?: boolean; rawQuotes?: boolean; typeAliases?: TypeAlias[] } = {},
): ValidationResult {
  const isList = opts.isList ?? false;
  const typeAliases = opts.typeAliases ?? [];
  const itemSchema = opts.rawQuotes
    ? llmSchema(model, models, false, typeAliases)
    : zodFromModel(model, models, typeAliases);
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

// AI : auto-structure (combine step / doc infer) — infer a StructureModel from a sample JSON value.
export function inferModel(sample: Record<string, unknown>, name: string, id: StructureModelId): StructureModel {
  const derived = inferStructuresFromJson(sample, name, () => id)
  return derived[0]?.model ?? { id, name, description: "Auto-generated structure.", auto: true, fields: [] }
}

// AI : human-readable schema line for logs — e.g. MarkingSchema { assignment_title: text, sections: list[RubricSection] }
export function formatStructureDef(model: StructureModel, models: StructureModel[] = []): string {
  const fields = model.fields
    .map((f) => `${f.name}: ${formatTypeExpr(fieldToTypeExpr(f), models)}`)
    .join(", ");
  return `${model.name} { ${fields} }`;
}

type StructureLog = { info: (msg: string, meta?: Record<string, unknown>) => void };

// AI : call after an LLM step emits a dynamic structure — tells later steps what shape to format to
export function logDynamicStructureCreated(
  log: StructureLog,
  model: StructureModel,
  value: unknown,
  models: StructureModel[] = [],
): void {
  const schemaLine = formatStructureDef(model, models);
  const meta: Record<string, unknown> = {
    structure: model.name,
    structureId: model.id,
    schema: schemaLine,
    dynamic: true,
  };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    if (Array.isArray(rec.sections)) {
      meta.sectionCount = rec.sections.length;
      meta.questionCount = (rec.sections as unknown[]).reduce<number>((n, s) => {
        const qs =
          s && typeof s === "object" ? (s as Record<string, unknown>).questions : undefined;
        return n + (Array.isArray(qs) ? qs.length : 0);
      }, 0);
    }
  }
  log.info(`dynamic structure created — downstream steps format to: ${schemaLine}`, meta);
}
