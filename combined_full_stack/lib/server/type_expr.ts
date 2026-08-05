import { z, type ZodType } from "zod";
import { isValidJsonString } from "@/lib/json-utils";
import { modelExportIdentifier, modelExportIdentifierGo, modelExportIdentifierRust } from "@/lib/structure-shape";
import type {
  FieldType,
  InputType,
  ModelField,
  PipelineModule,
  StructureModel,
  StructureModelId,
  TypeAlias,
} from "./types";
import { withBuiltinTypeAliases } from "./builtin_types";

// AI : canonical type IR — one definition for static checks, zod, pydantic, and codegen.
// AI : TODO (linter-first) — TypeExpr → generated models.py / models.rs only; delete parallel zod/cardinality
// AI :   logic once pyright + cargo check (or clippy) validate spine + custom-code on every save/CI.
// AI : TODO (linter-first) — set/map/union/generic: express in generated Py/Rust, not hand-rolled TS in validity.ts.
export type PrimName = "text" | "int" | "float" | "bool" | "datetime" | "json";

export type TypeExpr =
  | { kind: "prim"; name: PrimName }
  | { kind: "document" }
  | { kind: "quote" }
  | { kind: "text_quote" }
  | { kind: "list"; item: TypeExpr }
  | { kind: "ref"; modelId: StructureModelId }
  | { kind: "file"; inputTypes: InputType[] }
  | { kind: "optional"; inner: TypeExpr }
  | { kind: "set"; item: TypeExpr }
  | { kind: "map"; key: TypeExpr; value: TypeExpr }
  | { kind: "union"; variants: TypeExpr[] }
  | { kind: "generic"; name: string; args: TypeExpr[] }
  | { kind: "named"; name: string }
  | { kind: "unset" }
  | { kind: "unknown" };

export const UNSET_TYPE_EXPR: TypeExpr = { kind: "unset" };

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

// AI : typeExpr wins when set — enables tuple[Model, Model], Optional[Model], etc.
export function fieldToTypeExpr(field: Pick<ModelField, "type" | "ref" | "typeExpr">): TypeExpr {
  if (field.typeExpr) return field.typeExpr;
  return fieldTypeToExpr(field);
}

export function typeExprIsQuote(expr: TypeExpr): boolean {
  return expr.kind === "text_quote" || (expr.kind === "list" && expr.item.kind === "text_quote");
}

export function typeExprRefModelId(expr: TypeExpr): StructureModelId | undefined {
  if (expr.kind === "ref") return expr.modelId;
  if (expr.kind === "list" && expr.item.kind === "ref") return expr.item.modelId;
  if (expr.kind === "optional") return typeExprRefModelId(expr.inner);
  return undefined;
}

// AI : walk typeExpr for nested model refs — used by structure-ref + shape dedupe.
export function collectTypeExprRefModelIds(expr: TypeExpr): StructureModelId[] {
  const ids: StructureModelId[] = [];
  function walk(e: TypeExpr) {
    switch (e.kind) {
      case "ref":
        ids.push(e.modelId);
        break;
      case "list":
      case "set":
        walk(e.item);
        break;
      case "optional":
        walk(e.inner);
        break;
      case "map":
        walk(e.key);
        walk(e.value);
        break;
      case "union":
        e.variants.forEach(walk);
        break;
      case "generic":
        e.args.forEach(walk);
        break;
      default:
        break;
    }
  }
  walk(expr);
  return ids;
}


function resolveNamedTypeAlias(
  name: string,
  typeAliases: TypeAlias[],
  seenNames: Set<string>,
): TypeExpr | undefined {
  const key = name.trim().toLowerCase();
  if (!key || seenNames.has(key)) return undefined;
  const alias = withBuiltinTypeAliases(typeAliases).find((t) => t.name.trim().toLowerCase() === key);
  if (!alias) return undefined;
  seenNames.add(key);
  return alias.expr;
}

// AI : inline named aliases (built-ins + user) before quote detection and validation walks.
export function expandNamedTypeExpr(expr: TypeExpr, typeAliases: TypeAlias[] = []): TypeExpr {
  const aliases = withBuiltinTypeAliases(typeAliases);
  const seen = new Set<string>();
  function walk(e: TypeExpr): TypeExpr {
    if (e.kind === "named") {
      const resolved = resolveNamedTypeAlias(e.name, aliases, seen);
      return resolved ? walk(resolved) : e;
    }
    switch (e.kind) {
      case "list":
      case "set":
        return { ...e, item: walk(e.item) };
      case "optional":
        return { ...e, inner: walk(e.inner) };
      case "map":
        return { ...e, key: walk(e.key), value: walk(e.value) };
      case "union":
        return { ...e, variants: e.variants.map(walk) };
      case "generic":
        return { ...e, args: e.args.map(walk) };
      default:
        return e;
    }
  }
  return walk(expr);
}

export function typeExprIsList(expr: TypeExpr): boolean {
  return expr.kind === "list";
}

export function fieldIsListType(field: Pick<ModelField, "type" | "ref" | "typeExpr" | "minItems">): boolean {
  return typeExprIsList(fieldToTypeExpr(field));
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

// AI : list-ness on the spine is encoded in outType (list[T] vs T); llm-batch always emits a list.
export function stepEmitsList(m: PipelineModule | undefined): boolean {
  if (!m) return false;
  if (m.outType) return isListRoot(m.outType);
  if (m.kind === "llm-batch" || m.kind === "example-select") return true;
  if (m.kind === "chunk") return true;
  return !!(m as PipelineModule & { outIsList?: boolean }).outIsList;
}

export function stepSpineOutType(m: PipelineModule | undefined): TypeExpr | undefined {
  if (!m) return undefined;
  if (m.outType) return m.outType;
  if (m.kind === "output" || m.kind === "assert" || m.kind === "human-review") {
    const id = m.inStructureId ?? m.outStructureId;
    return id ? structureSpineType(id, stepEmitsList(m)) : undefined;
  }
  if (!m.outStructureId) return undefined;
  if (m.kind === "transform" && !m.code?.trim() && !stepEmitsList(m)) {
    return structureSpineType(m.outStructureId, false);
  }
  return structureSpineType(m.outStructureId, stepEmitsList(m));
}

export function stepSpineInType(m: PipelineModule): TypeExpr | undefined {
  if (m.inType) return m.inType;
  if (!m.inStructureId) return undefined;
  if (m.kind === "llm-batch" || m.kind === "example-select") {
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
    case "unset":
      return true;
    case "named":
      return b.kind === "named" && a.name === b.name;
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
    case "optional":
      return b.kind === "optional" && typeExprEqual(a.inner, b.inner);
    case "set":
      return b.kind === "set" && typeExprEqual(a.item, b.item);
    case "map":
      return (
        b.kind === "map" &&
        typeExprEqual(a.key, b.key) &&
        typeExprEqual(a.value, b.value)
      );
    case "union":
      return (
        b.kind === "union" &&
        a.variants.length === b.variants.length &&
        a.variants.every((v, i) => typeExprEqual(v, b.variants[i]!))
      );
    case "generic":
      return (
        b.kind === "generic" &&
        a.name === b.name &&
        a.args.length === b.args.length &&
        a.args.every((arg, i) => typeExprEqual(arg, b.args[i]!))
      );
    default:
      return false;
  }
}

export function cardinalityMismatch(expected: TypeExpr, actual: TypeExpr): boolean {
  // AI : TODO (linter-first) — replace with generated step fn signatures + pyright/cargo assignability check.
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
      return "quote_string_t";
    case "text_quote":
      return "text_quote_t";
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
    case "optional":
      return `optional[${formatTypeExpr(expr.inner, models)}]`;
    case "set":
      return `set[${formatTypeExpr(expr.item, models)}]`;
    case "map":
      return `map[${formatTypeExpr(expr.key, models)}, ${formatTypeExpr(expr.value, models)}]`;
    case "union":
      return expr.variants.map((v) => formatTypeExpr(v, models)).join(" | ");
    case "generic":
      return expr.args.length
        ? `${expr.name}[${expr.args.map((a) => formatTypeExpr(a, models)).join(", ")}]`
        : expr.name;
    case "named":
      return expr.name;
    case "unset":
      return "UNSET";
    case "unknown":
      return "?";
    default:
      return "?";
  }
}

type LegacyModelField = ModelField & { example?: string };

function fieldExamplesList(f: ModelField): string[] {
  const legacy = (f as LegacyModelField).example?.trim();
  const fromList = (f.examples ?? []).map((e) => e.trim()).filter(Boolean);
  if (fromList.length) return fromList;
  return legacy ? [legacy] : [];
}

function fieldNegativeExamplesList(f: ModelField): string[] {
  return (f.negativeExamples ?? []).map((e) => e.trim()).filter(Boolean);
}

// AI : legacy `example` string → examples[] on load / patch
export function normalizeModelField(f: ModelField): ModelField {
  const examples = fieldExamplesList(f);
  const negativeExamples = fieldNegativeExamplesList(f);
  const { example: _legacy, ...rest } = f as LegacyModelField;
  return {
    ...rest,
    ...(examples.length ? { examples } : {}),
    ...(negativeExamples.length ? { negativeExamples } : {}),
  };
}

export function normalizeStructureModels(models: StructureModel[]): StructureModel[] {
  return models.map((m) => ({
    ...m,
    fields: m.fields.map(normalizeModelField),
  }));
}

function fieldDescribe(f: ModelField): string | undefined {
  const parts: string[] = [];
  if (f.description.trim()) parts.push(f.description.trim());
  const examples = fieldExamplesList(f);
  if (examples.length) {
    parts.push(`Examples: ${examples.map((e) => JSON.stringify(e)).join(", ")}`);
  }
  const negatives = fieldNegativeExamplesList(f);
  if (negatives.length) {
    parts.push(`Do NOT use as values: ${negatives.map((e) => JSON.stringify(e)).join(", ")}`);
  }
  return parts.length ? parts.join(" — ") : undefined;
}

export function withFieldMeta(schema: ZodType, f: ModelField): ZodType {
  const d = fieldDescribe(f);
  return d ? schema.describe(d) : schema;
}

type TypeExprToZodOpts = {
  seen?: Set<StructureModelId>;
  llmQuotes?: boolean;
  typeAliases?: TypeAlias[];
  seenAliasNames?: Set<string>;
};

function refZod(
  ref: StructureModelId | undefined,
  index: Map<StructureModelId, StructureModel>,
  opts: TypeExprToZodOpts,
): ZodType {
  const model = ref ? index.get(ref) : undefined;
  if (!model) return z.record(z.string(), z.unknown());
  return modelToZod(model, index, opts);
}

export function typeExprToZod(
  expr: TypeExpr,
  models: StructureModel[],
  seenOrOpts: Set<StructureModelId> | TypeExprToZodOpts = new Set(),
  llmQuotes = false,
  typeAliases: TypeAlias[] = [],
): ZodType {
  const opts: TypeExprToZodOpts =
    seenOrOpts instanceof Set
      ? { seen: seenOrOpts, llmQuotes, typeAliases, seenAliasNames: new Set<string>() }
      : {
          seen: seenOrOpts.seen ?? new Set(),
          llmQuotes: seenOrOpts.llmQuotes ?? false,
          typeAliases: seenOrOpts.typeAliases ?? [],
          seenAliasNames: seenOrOpts.seenAliasNames ?? new Set<string>(),
        };
  const { seen, typeAliases: aliases = [] } = opts;
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
      return opts.llmQuotes ? z.string() : QuoteSchema;
    case "text_quote":
      return llmQuotes ? z.string() : TextQuoteSchema;
    case "list":
      return z.array(typeExprToZod(expr.item, models, opts));
    case "ref":
      return refZod(expr.modelId, index, opts);
    case "optional":
      return typeExprToZod(expr.inner, models, opts).optional();
    case "set":
      // AI : TODO (linter-first) — JSON has no set; validate via generated Rust HashSet or pydantic conset, not z.array.
      return z.array(typeExprToZod(expr.item, models, opts));
    case "map":
      // AI : TODO (linter-first) — non-str map keys need generated Py/Rust types + pyright/cargo, not z.record alone.
      return z.record(
        typeExprToZod(expr.key, models, opts) as z.ZodString,
        typeExprToZod(expr.value, models, opts),
      );
    case "union":
      return z.union(
        expr.variants.map((v) => typeExprToZod(v, models, opts)) as [
          ZodType,
          ZodType,
          ...ZodType[],
        ],
      );
    case "generic":
      if (expr.name === "tuple" && expr.args.length >= 2) {
        return z.tuple(
          expr.args.map((a) => typeExprToZod(a, models, opts)) as [
            ZodType,
            ZodType,
            ...ZodType[],
          ],
        );
      }
      if (expr.args.length === 1) {
        return typeExprToZod(expr.args[0]!, models, opts);
      }
      return z.record(z.string(), z.unknown());
    case "named": {
      const resolved = resolveNamedTypeAlias(expr.name, aliases, opts.seenAliasNames!);
      if (resolved) return typeExprToZod(resolved, models, opts);
      return z.string();
    }
    case "unset":
      return z.never();
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
  opts: TypeExprToZodOpts,
): ZodType {
  const seen = opts.seen ?? new Set();
  if (seen.has(model.id)) return z.record(z.string(), z.unknown());
  const next: TypeExprToZodOpts = { ...opts, seen: new Set(seen).add(model.id) };
  const shape: Record<string, ZodType> = {};
  for (const f of model.fields) {
    if (!f.name.trim()) continue;
    let base = withFieldMeta(
      typeExprToZod(fieldToTypeExpr(f), [...index.values()], next),
      f,
    );
    if (f.minItems && f.minItems > 1 && fieldIsListType(f) && base instanceof z.ZodArray) {
      base = base.min(f.minItems);
    }
    shape[f.name] = f.optional
      ? opts.llmQuotes
        ? base.optional()
        : base.nullish()
      : base;
  }
  return z.object(shape);
}

export function zodFromModel(
  model: StructureModel,
  models: StructureModel[] = [],
  llmQuotes = false,
  typeAliases: TypeAlias[] = [],
): ZodType {
  return modelToZod(model, byId(models.length ? models : [model]), {
    seen: new Set(),
    llmQuotes,
    typeAliases,
    seenAliasNames: new Set(),
  });
}

export function spineTypeToZod(expr: TypeExpr, models: StructureModel[], typeAliases: TypeAlias[] = []): ZodType {
  return typeExprToZod(expr, models, { typeAliases, seenAliasNames: new Set() });
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
      return "quote_string_t";
    case "text_quote":
      return "text_quote_t";
    case "list":
      return `list[${typeExprToPy(expr.item, models)}]`;
    case "ref": {
      const name = modelName(models, expr.modelId);
      return name ? modelExportIdentifier(name) : "Any";
    }
    case "optional":
      return `${typeExprToPy(expr.inner, models)} | None`;
    case "set":
      return `set[${typeExprToPy(expr.item, models)}]`;
    case "map":
      return `dict[${typeExprToPy(expr.key, models)}, ${typeExprToPy(expr.value, models)}]`;
    case "union":
      return expr.variants.map((v) => typeExprToPy(v, models)).join(" | ");
    case "generic":
      if (expr.name === "tuple") {
        return `tuple[${expr.args.map((a) => typeExprToPy(a, models)).join(", ")}]`;
      }
      return expr.args.length
        ? `${expr.name}[${expr.args.map((a) => typeExprToPy(a, models)).join(", ")}]`
        : expr.name;
    case "named":
      return expr.name;
    case "unset":
      return "UNSET";
    case "file":
      return "FileInput";
    case "unknown":
      return "Any";
    default:
      return "Any";
  }
}

export function fieldToPy(field: ModelField, models: StructureModel[]): string {
  const expr = fieldToTypeExpr(field);
  let t = typeExprToPy(expr, models);
  if (field.optional && expr.kind !== "optional") t = `${t} | None`;
  const fieldArgs: string[] = [];
  if (field.optional) fieldArgs.push("default=None");
  const negatives = fieldNegativeExamplesList(field);
  const desc =
    field.description.trim() ||
    (negatives.length
      ? `Do NOT use as values: ${negatives.map((e) => JSON.stringify(e)).join(", ")}`
      : "");
  const descWithNegatives =
    field.description.trim() && negatives.length
      ? `${field.description.trim()} — Do NOT use as values: ${negatives.map((e) => JSON.stringify(e)).join(", ")}`
      : desc;
  if (descWithNegatives) fieldArgs.push(`description=${JSON.stringify(descWithNegatives)}`);
  const examples = fieldExamplesList(field);
  if (examples.length) {
    fieldArgs.push(`examples=[${examples.map((e) => JSON.stringify(e)).join(", ")}]`);
  }
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
      return "quote_string_t";
    case "text_quote":
      return "text_quote_t";
    case "list":
      return `${typeExprToTs(expr.item, models)}[]`;
    case "ref": {
      const name = modelName(models, expr.modelId);
      return name ? modelExportIdentifier(name) : "unknown";
    }
    case "optional":
      return `${typeExprToTs(expr.inner, models)} | undefined`;
    case "set":
      return `Set<${typeExprToTs(expr.item, models)}>`;
    case "map":
      return `Record<${typeExprToTs(expr.key, models)}, ${typeExprToTs(expr.value, models)}>`;
    case "union":
      return expr.variants.map((v) => typeExprToTs(v, models)).join(" | ");
    case "generic":
      if (expr.name === "tuple") {
        return `[${expr.args.map((a) => typeExprToTs(a, models)).join(", ")}]`;
      }
      return expr.args.length
        ? `${expr.name}<${expr.args.map((a) => typeExprToTs(a, models)).join(", ")}>`
        : expr.name;
    case "named":
      return expr.name;
    case "unset":
      return "never";
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

// AI : wrap composite BAML types before postfix ? / [] so `int | string` stays grouped.
function bamlNeedsParens(expr: TypeExpr): boolean {
  return expr.kind === "union" || expr.kind === "optional" || expr.kind === "map";
}

function bamlWrap(expr: TypeExpr, models: StructureModel[]): string {
  const inner = typeExprToBaml(expr, models);
  return bamlNeedsParens(expr) ? `(${inner})` : inner;
}

// AI : BAML type strings — https://docs.boundaryml.com/ref/baml/types (no datetime/json/set/tuple).
export function typeExprToBaml(expr: TypeExpr, models: StructureModel[] = []): string {
  switch (expr.kind) {
    case "prim":
      switch (expr.name) {
        case "text":
        case "datetime":
        case "json":
          return "string";
        case "int":
          return "int";
        case "float":
          return "float";
        case "bool":
          return "bool";
        default:
          return "string";
      }
    case "document":
      return "Document";
    case "quote":
      return "string";
    case "text_quote":
      return "TextQuote";
    case "list":
      return `${bamlWrap(expr.item, models)}[]`;
    case "ref": {
      const name = modelName(models, expr.modelId);
      return name ? modelExportIdentifierRust(name) : "string";
    }
    case "optional":
      return `${bamlWrap(expr.inner, models)}?`;
    case "set":
      // AI : BAML has no set — list is the documented substitute.
      return `${bamlWrap(expr.item, models)}[]`;
    case "map":
      return `map<${typeExprToBaml(expr.key, models)}, ${typeExprToBaml(expr.value, models)}>`;
    case "union":
      return expr.variants.map((v) => typeExprToBaml(v, models)).join(" | ");
    case "generic":
      if (expr.name === "tuple") {
        // AI : BAML has no tuple — flatten to a descriptive string placeholder.
        return "string";
      }
      return expr.args.length
        ? `${expr.name}<${expr.args.map((a) => typeExprToBaml(a, models)).join(", ")}>`
        : expr.name;
    case "named":
      return expr.name;
    case "unset":
      return "null";
    case "file":
      return "FileInput";
    case "unknown":
      return "string";
    default:
      return "string";
  }
}

// AI : Rust type strings for pipeline export — serde-friendly, JSON Value for open shapes.
export function typeExprToRust(expr: TypeExpr, models: StructureModel[] = []): string {
  switch (expr.kind) {
    case "prim":
      switch (expr.name) {
        case "text":
        case "datetime":
          return "String";
        case "json":
          return "serde_json::Value";
        case "int":
          return "i64";
        case "float":
          return "f64";
        case "bool":
          return "bool";
        default:
          return "serde_json::Value";
      }
    case "document":
      return "Document";
    case "quote":
      return "QuoteSpan";
    case "text_quote":
      return "TextQuoteLoose";
    case "list":
      return `Vec<${typeExprToRust(expr.item, models)}>`;
    case "ref": {
      const name = modelName(models, expr.modelId);
      return name ? modelExportIdentifierRust(name) : "serde_json::Value";
    }
    case "optional":
      return `Option<${typeExprToRust(expr.inner, models)}>`;
    case "set":
      return `std::collections::HashSet<${typeExprToRust(expr.item, models)}>`;
    case "map":
      return `std::collections::HashMap<${typeExprToRust(expr.key, models)}, ${typeExprToRust(expr.value, models)}>`;
    case "union":
      // AI : untagged unions → Value; callers can narrow after deserialize.
      return "serde_json::Value";
    case "generic":
      if (expr.name === "tuple") {
        return `(${expr.args.map((a) => typeExprToRust(a, models)).join(", ")})`;
      }
      return expr.args.length
        ? `${expr.name}<${expr.args.map((a) => typeExprToRust(a, models)).join(", ")}>`
        : expr.name;
    case "named":
      return expr.name;
    case "unset":
      return "!";
    case "file":
      return "FileInput";
    case "unknown":
      return "serde_json::Value";
    default:
      return "serde_json::Value";
  }
}

// AI : Go type strings for pipeline export — JSON tags on structs; RawMessage for open shapes.
export function typeExprToGo(expr: TypeExpr, models: StructureModel[] = []): string {
  switch (expr.kind) {
    case "prim":
      switch (expr.name) {
        case "text":
        case "datetime":
          return "string";
        case "json":
          return "json.RawMessage";
        case "int":
          return "int64";
        case "float":
          return "float64";
        case "bool":
          return "bool";
        default:
          return "json.RawMessage";
      }
    case "document":
      return "Document";
    case "quote":
      return "QuoteSpan";
    case "text_quote":
      return "TextQuoteLoose";
    case "list":
      return `[]${typeExprToGo(expr.item, models)}`;
    case "ref": {
      const name = modelName(models, expr.modelId);
      return name ? modelExportIdentifierGo(name) : "json.RawMessage";
    }
    case "optional":
      return `*${typeExprToGo(expr.inner, models)}`;
    case "set":
      // AI : Go has no set — slice is the practical substitute.
      return `[]${typeExprToGo(expr.item, models)}`;
    case "map":
      return `map[${typeExprToGo(expr.key, models)}]${typeExprToGo(expr.value, models)}`;
    case "union":
      return "json.RawMessage";
    case "generic":
      if (expr.name === "tuple") {
        // AI : Go has no tuple — fall back to RawMessage.
        return "json.RawMessage";
      }
      return expr.args.length
        ? `${expr.name}[${expr.args.map((a) => typeExprToGo(a, models)).join(", ")}]`
        : expr.name;
    case "named":
      return expr.name;
    case "unset":
      return "struct{}";
    case "file":
      return "FileInput";
    case "unknown":
      return "json.RawMessage";
    default:
      return "json.RawMessage";
  }
}
