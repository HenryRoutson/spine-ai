import { z, type ZodType } from "zod";
import type {
  FieldType,
  InputType,
  ModelField,
  PipelineModule,
  StructureModel,
  StructureModelId,
} from "./types";
function isValidJsonString(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

// AI : canonical type IR — one definition for static checks, zod, pydantic, and codegen.
export type PrimName = "text" | "int" | "float" | "bool" | "datetime" | "json";

export type TypeExpr =
  | { kind: "prim"; name: PrimName }
  | { kind: "document" }
  | { kind: "quote" }
  | { kind: "text_quote" }
  | { kind: "list"; item: TypeExpr }
  | { kind: "ref"; modelId: StructureModelId }
  | { kind: "file"; inputTypes: InputType[] }
  | { kind: "unknown" };

export const QuoteSchema = z.object({
  doc_id: z.string(),
  start: z.number().int(),
  end: z.number().int(),
});

const TextQuoteSchema = z.object({ text: z.string(), quote: QuoteSchema });
const DocumentSchema = z.object({ content: z.string(), filename: z.string() });
const JsonStringSchema = z.string().refine(isValidJsonString, { message: "must be valid JSON" });

function byId(models: StructureModel[]): Map<StructureModelId, StructureModel> {
  return new Map(models.map((m) => [m.id, m]));
}

export function fieldTypeToExpr(field: Pick<ModelField, "type" | "ref">): TypeExpr {
  switch (field.type) {
    case "text":
      return { kind: "prim", name: "text" };
    case "int":
      return { kind: "prim", name: "int" };
    case "float":
      return { kind: "prim", name: "float" };
    case "bool":
      return { kind: "prim", name: "bool" };
    case "datetime":
      return { kind: "prim", name: "datetime" };
    case "json":
      return { kind: "prim", name: "json" };
    case "document":
      return { kind: "document" };
    case "list[document]":
      return { kind: "list", item: { kind: "document" } };
    case "list[text]":
      return { kind: "list", item: { kind: "prim", name: "text" } };
    case "tuple[text,quote]":
      return { kind: "text_quote" };
    case "list[tuple[text,quote]]":
      return { kind: "list", item: { kind: "text_quote" } };
    case "model":
      return field.ref ? { kind: "ref", modelId: field.ref } : { kind: "unknown" };
    case "list[model]":
      return {
        kind: "list",
        item: field.ref ? { kind: "ref", modelId: field.ref } : { kind: "unknown" },
      };
    default:
      return { kind: "unknown" };
  }
}

export function isListFieldType(type: FieldType): boolean {
  return (
    type === "list[text]" ||
    type === "list[document]" ||
    type === "list[model]" ||
    type === "list[tuple[text,quote]]"
  );
}

function structureSpineType(modelId: StructureModelId | undefined, isList: boolean): TypeExpr | undefined {
  if (!modelId) return undefined;
  const base: TypeExpr = { kind: "ref", modelId };
  return isList ? { kind: "list", item: base } : base;
}

// AI : mirrors validity.ts — llm-batch and outIsList steps put a bare array on the spine.
export function stepEmitsList(m: PipelineModule | undefined): boolean {
  if (!m) return false;
  if (m.kind === "llm-batch") return true;
  return !!m.outIsList;
}

export function stepSpineOutType(m: PipelineModule | undefined): TypeExpr | undefined {
  if (!m) return undefined;
  if (m.kind === "output" || m.kind === "assert" || m.kind === "human-review") {
    const id = m.inStructureId ?? m.outStructureId;
    return id ? structureSpineType(id, false) : undefined;
  }
  if (!m.outStructureId) return undefined;
  if (m.kind === "transform" && !m.code?.trim() && !m.outIsList) {
    return structureSpineType(m.outStructureId, false);
  }
  return structureSpineType(m.outStructureId, stepEmitsList(m));
}

export function stepSpineInType(m: PipelineModule): TypeExpr | undefined {
  if (!m.inStructureId) return undefined;
  if (m.kind === "llm-batch") {
    return { kind: "list", item: { kind: "ref", modelId: m.inStructureId } };
  }
  return { kind: "ref", modelId: m.inStructureId };
}

export function inputFileType(m: PipelineModule): TypeExpr | undefined {
  if (m.kind !== "input" || !m.inputType) return undefined;
  const types = Array.isArray(m.inputType) ? m.inputType : [m.inputType];
  return types.length ? { kind: "file", inputTypes: types } : undefined;
}

function innerRef(expr: TypeExpr): StructureModelId | undefined {
  if (expr.kind === "ref") return expr.modelId;
  if (expr.kind === "list" && expr.item.kind === "ref") return expr.item.modelId;
  return undefined;
}

export function isListRoot(expr: TypeExpr): boolean {
  return expr.kind === "list";
}

export function typeExprEqual(a: TypeExpr, b: TypeExpr): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "prim":
      return b.kind === "prim" && a.name === b.name;
    case "document":
    case "quote":
    case "text_quote":
    case "unknown":
      return true;
    case "list":
      return b.kind === "list" && typeExprEqual(a.item, b.item);
    case "ref":
      return b.kind === "ref" && a.modelId === b.modelId;
    case "file": {
      if (b.kind !== "file") return false;
      const as = [...a.inputTypes].sort().join(",");
      const bs = [...b.inputTypes].sort().join(",");
      return as === bs;
    }
    default:
      return false;
  }
}

export function cardinalityMismatch(expected: TypeExpr, actual: TypeExpr): boolean {
  const eList = isListRoot(expected);
  const aList = isListRoot(actual);
  if (eList === aList) return false;
  const eRef = innerRef(expected);
  const aRef = innerRef(actual);
  return eRef !== undefined && aRef !== undefined && eRef === aRef;
}

export function modelName(models: StructureModel[], id?: StructureModelId): string | undefined {
  return models.find((m) => m.id === id)?.name;
}

export function formatTypeExpr(expr: TypeExpr, models: StructureModel[] = []): string {
  switch (expr.kind) {
    case "prim":
      return expr.name;
    case "document":
      return "Document";
    case "quote":
      return "Quote";
    case "text_quote":
      return "TextQuote";
    case "list":
      return `list[${formatTypeExpr(expr.item, models)}]`;
    case "ref": {
      const name = modelName(models, expr.modelId);
      return name ?? expr.modelId;
    }
    case "file":
      return expr.inputTypes.length === 1
        ? `file(${expr.inputTypes[0]})`
        : `file(${expr.inputTypes.join("|")})`;
    case "unknown":
      return "?";
    default:
      return "?";
  }
}

function fieldDescribe(f: ModelField): string | undefined {
  const parts: string[] = [];
  if (f.description.trim()) parts.push(f.description.trim());
  const ex = f.example?.trim();
  if (ex) parts.push(`Example: ${ex}`);
  return parts.length ? parts.join(" — ") : undefined;
}

export function withFieldMeta(schema: ZodType, f: ModelField): ZodType {
  const d = fieldDescribe(f);
  return d ? schema.describe(d) : schema;
}

function refZod(
  ref: StructureModelId | undefined,
  index: Map<StructureModelId, StructureModel>,
  seen: Set<StructureModelId>,
  llmQuotes: boolean,
): ZodType {
  const model = ref ? index.get(ref) : undefined;
  if (!model) return z.record(z.string(), z.unknown());
  return modelToZod(model, index, seen, llmQuotes);
}

export function typeExprToZod(
  expr: TypeExpr,
  models: StructureModel[],
  seen: Set<StructureModelId> = new Set(),
  llmQuotes = false,
): ZodType {
  const index = byId(models);
  switch (expr.kind) {
    case "prim":
      switch (expr.name) {
        case "text":
        case "datetime":
          return z.string();
        case "int":
          return z.number().int();
        case "float":
          return z.number();
        case "bool":
          return z.boolean();
        case "json":
          return JsonStringSchema;
        default:
          return z.unknown();
      }
    case "document":
      return DocumentSchema;
    case "quote":
      return QuoteSchema;
    case "text_quote":
      return llmQuotes ? z.string() : TextQuoteSchema;
    case "list":
      return z.array(typeExprToZod(expr.item, models, seen, llmQuotes));
    case "ref":
      return refZod(expr.modelId, index, seen, llmQuotes);
    case "file":
    case "unknown":
      return z.unknown();
    default:
      return z.unknown();
  }
}

function modelToZod(
  model: StructureModel,
  index: Map<StructureModelId, StructureModel>,
  seen: Set<StructureModelId>,
  llmQuotes: boolean,
): ZodType {
  if (seen.has(model.id)) return z.record(z.string(), z.unknown());
  const next = new Set(seen).add(model.id);
  const shape: Record<string, ZodType> = {};
  for (const f of model.fields) {
    if (!f.name.trim()) continue;
    let base = withFieldMeta(typeExprToZod(fieldTypeToExpr(f), [...index.values()], next, llmQuotes), f);
    if (f.minItems && f.minItems > 1 && isListFieldType(f.type) && base instanceof z.ZodArray) {
      base = base.min(f.minItems);
    }
    shape[f.name] = f.optional
      ? llmQuotes
        ? base.optional()
        : base.nullish()
      : base;
  }
  return z.object(shape);
}

export function zodFromModel(model: StructureModel, models: StructureModel[] = [], llmQuotes = false): ZodType {
  return modelToZod(model, byId(models.length ? models : [model]), new Set(), llmQuotes);
}

export function spineTypeToZod(expr: TypeExpr, models: StructureModel[]): ZodType {
  return typeExprToZod(expr, models);
}

function pyPrim(name: PrimName): string {
  switch (name) {
    case "text":
    case "datetime":
    case "json":
      return "str";
    case "int":
      return "int";
    case "float":
      return "float";
    case "bool":
      return "bool";
    default:
      return "Any";
  }
}

export function typeExprToPy(expr: TypeExpr, models: StructureModel[] = []): string {
  switch (expr.kind) {
    case "prim":
      return pyPrim(expr.name);
    case "document":
      return "Document";
    case "quote":
      return "Quote";
    case "text_quote":
      return "TextQuote";
    case "list":
      return `list[${typeExprToPy(expr.item, models)}]`;
    case "ref": {
      const name = modelName(models, expr.modelId);
      return name ?? "Any";
    }
    case "file":
      return "FileInput";
    case "unknown":
      return "Any";
    default:
      return "Any";
  }
}

export function fieldToPy(field: ModelField, models: StructureModel[]): string {
  let t = typeExprToPy(fieldTypeToExpr(field), models);
  if (field.optional) t = `Optional[${t}]`;
  const fieldArgs: string[] = [];
  if (field.optional) fieldArgs.push("default=None");
  if (field.description) fieldArgs.push(`description=${JSON.stringify(field.description)}`);
  const ex = field.example?.trim();
  if (ex) fieldArgs.push(`examples=[${JSON.stringify(ex)}]`);
  const rhs = fieldArgs.length ? ` = Field(${fieldArgs.join(", ")})` : "";
  return `    ${field.name}: ${t}${rhs}`;
}

export function typeExprToTs(expr: TypeExpr, models: StructureModel[] = []): string {
  switch (expr.kind) {
    case "prim":
      switch (expr.name) {
        case "text":
        case "datetime":
        case "json":
          return "string";
        case "int":
        case "float":
          return "number";
        case "bool":
          return "boolean";
        default:
          return "unknown";
      }
    case "document":
      return "Document";
    case "quote":
      return "Quote";
    case "text_quote":
      return "TextQuote";
    case "list":
      return `${typeExprToTs(expr.item, models)}[]`;
    case "ref": {
      const name = modelName(models, expr.modelId);
      return name ?? "unknown";
    }
    case "file":
      return "FileInput";
    case "unknown":
      return "unknown";
    default:
      return "unknown";
  }
}

export function labelToPyKey(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "_empty";
  return trimmed.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^(\d)/, "_$1");
}
