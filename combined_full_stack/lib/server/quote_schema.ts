import { expandNamedTypeExpr, fieldToTypeExpr, typeExprIsQuote, typeExprRefModelId } from "./type_expr";
import type { TypeExpr } from "./type_expr";
import type { DocId, ModelField, StructureModel, StructureModelId } from "./types";

// AI : TODO (spec) — quote validation walks struct tree for quote fields only (no brute-force dict scan); partially via collectQuotesForModel.
export type LinkedQuoteValue = {
  text: string;
  quote: { doc_id: DocId; start: number; end: number };
};

export type QuoteLinker = (verbatim: string) => LinkedQuoteValue;

function byId(models: StructureModel[]): Map<StructureModelId, StructureModel> {
  return new Map(models.map((m) => [m.id, m]));
}

function refModelFromExpr(
  expr: TypeExpr,
  index: Map<StructureModelId, StructureModel>,
): StructureModel | undefined {
  const refId = typeExprRefModelId(expr);
  return refId ? index.get(refId) : undefined;
}

function exprHasQuoteFields(
  expr: TypeExpr,
  models: StructureModel[],
  index: Map<StructureModelId, StructureModel>,
  seen: Set<StructureModelId>,
): boolean {
  expr = expandNamedTypeExpr(expr);
  if (typeExprIsQuote(expr)) return true;
  const refId = typeExprRefModelId(expr);
  if (refId) {
    const ref = index.get(refId);
    if (ref && modelHasQuoteFields(ref, models, seen)) return true;
  }
  if (expr.kind === "optional") return exprHasQuoteFields(expr.inner, models, index, seen);
  if (expr.kind === "list") return exprHasQuoteFields(expr.item, models, index, seen);
  if (expr.kind === "generic" && expr.name === "tuple") {
    return expr.args.some((arg) => exprHasQuoteFields(arg, models, index, seen));
  }
  if (expr.kind === "union") {
    return expr.variants.some((v) => exprHasQuoteFields(v, models, index, seen));
  }
  return false;
}

function resolveQuoteExpr(
  expr: TypeExpr,
  raw: unknown,
  models: StructureModel[],
  index: Map<StructureModelId, StructureModel>,
  link: QuoteLinker,
  seen: Set<StructureModelId>,
): unknown {
  expr = expandNamedTypeExpr(expr);
  if (typeExprIsQuote(expr)) return linkQuoteField(raw, link);
  if (expr.kind === "list" && expr.item.kind === "text_quote") return linkQuoteList(raw, link);
  if (expr.kind === "list" && expr.item.kind === "ref" && Array.isArray(raw)) {
    const ref = refModelFromExpr(expr.item, index);
    if (!ref) return raw;
    return raw.map((row) => resolveQuotesOnRow(row, ref, models, link, seen));
  }
  if (expr.kind === "ref") {
    const ref = refModelFromExpr(expr, index);
    if (ref) return resolveQuotesOnRow(raw, ref, models, link, seen);
    return raw;
  }
  if (expr.kind === "optional") {
    if (raw === undefined || raw === null) return raw;
    return resolveQuoteExpr(expr.inner, raw, models, index, link, seen);
  }
  if (expr.kind === "generic" && expr.name === "tuple" && Array.isArray(raw)) {
    return raw.map((item, i) =>
      resolveQuoteExpr(expr.args[i] ?? { kind: "unknown" }, item, models, index, link, seen),
    );
  }
  return raw;
}

function collectQuoteExpr(
  expr: TypeExpr,
  raw: unknown,
  models: StructureModel[],
  index: Map<StructureModelId, StructureModel>,
  out: LinkedQuoteValue[],
  seen: Set<StructureModelId>,
): void {
  expr = expandNamedTypeExpr(expr);
  if (typeExprIsQuote(expr)) {
    pushLinkedQuote(raw, out);
    return;
  }
  if (expr.kind === "list" && expr.item.kind === "text_quote" && Array.isArray(raw)) {
    for (const item of raw) pushLinkedQuote(item, out);
    return;
  }
  if (expr.kind === "list" && expr.item.kind === "ref" && Array.isArray(raw)) {
    const ref = refModelFromExpr(expr.item, index);
    if (!ref) return;
    for (const row of raw) collectQuotesOnRow(row, ref, models, out, seen);
    return;
  }
  if (expr.kind === "ref") {
    const ref = refModelFromExpr(expr, index);
    if (ref) collectQuotesOnRow(raw, ref, models, out, seen);
    return;
  }
  if (expr.kind === "optional") {
    if (raw === undefined || raw === null) return;
    collectQuoteExpr(expr.inner, raw, models, index, out, seen);
    return;
  }
  if (expr.kind === "generic" && expr.name === "tuple" && Array.isArray(raw)) {
    raw.forEach((item, i) =>
      collectQuoteExpr(expr.args[i] ?? { kind: "unknown" }, item, models, index, out, seen),
    );
  }
}

function quotePathsForExpr(
  expr: TypeExpr,
  models: StructureModel[],
  index: Map<StructureModelId, StructureModel>,
  path: string,
  seen: Set<StructureModelId>,
): string[] {
  expr = expandNamedTypeExpr(expr);
  if (typeExprIsQuote(expr)) return [path];
  const refId = typeExprRefModelId(expr);
  if (refId) {
    const ref = index.get(refId);
    if (ref) return quoteFieldPaths(ref, models, path, seen);
    return [];
  }
  if (expr.kind === "list" && expr.item.kind === "ref") {
    const ref = refModelFromExpr(expr.item, index);
    if (ref) return quoteFieldPaths(ref, models, `${path}[]`, seen);
    return [];
  }
  if (expr.kind === "optional") return quotePathsForExpr(expr.inner, models, index, path, seen);
  return [];
}

// AI : true when this model or any nested model ref carries a quote field.
export function modelHasQuoteFields(
  model: StructureModel,
  models: StructureModel[],
  seen: Set<StructureModelId> = new Set(),
): boolean {
  if (seen.has(model.id)) return false;
  const next = new Set(seen).add(model.id);
  const index = byId(models);

  for (const f of model.fields) {
    if (!f.name.trim()) continue;
    if (exprHasQuoteFields(fieldToTypeExpr(f), models, index, next)) return true;
  }
  return false;
}

function isLinkedQuote(v: unknown): v is LinkedQuoteValue {
  if (!v || typeof v !== "object") return false;
  const o = v as LinkedQuoteValue;
  return (
    typeof o.text === "string" &&
    typeof o.quote?.doc_id === "string" &&
    typeof o.quote.start === "number" &&
    typeof o.quote.end === "number"
  );
}

function linkQuoteField(raw: unknown, link: QuoteLinker): unknown {
  if (typeof raw === "string") return link(raw);
  if (isLinkedQuote(raw)) return raw;
  return raw;
}

function linkQuoteList(raw: unknown, link: QuoteLinker): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((item) => linkQuoteField(item, link));
}

// AI : walk one object row along declared fields — recurse only through model / list[model] refs.
function resolveQuotesOnRow(
  value: unknown,
  model: StructureModel,
  models: StructureModel[],
  link: QuoteLinker,
  seen: Set<StructureModelId>,
): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  if (seen.has(model.id)) return value;

  const next = new Set(seen).add(model.id);
  const index = byId(models);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = { ...obj };

  for (const f of model.fields) {
    if (!f.name.trim()) continue;
    const raw = obj[f.name];
    if (raw === undefined) continue;

    out[f.name] = resolveQuoteExpr(fieldToTypeExpr(f), raw, models, index, link, next);
  }
  return out;
}

// AI : resolve every schema-declared quote field on a step value (single object or list of rows).
export function resolveQuotesForModel(
  value: unknown,
  model: StructureModel,
  models: StructureModel[],
  link: QuoteLinker,
  isList: boolean,
): unknown {
  if (isList && Array.isArray(value)) {
    return value.map((row) => resolveQuotesOnRow(row, model, models, link, new Set()));
  }
  return resolveQuotesOnRow(value, model, models, link, new Set());
}

function pushLinkedQuote(v: unknown, out: LinkedQuoteValue[]): void {
  if (isLinkedQuote(v)) out.push(v);
}

// AI : collect linked quotes by following the same field graph (for export / logging links).
function collectQuotesOnRow(
  value: unknown,
  model: StructureModel,
  models: StructureModel[],
  out: LinkedQuoteValue[],
  seen: Set<StructureModelId>,
): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  if (seen.has(model.id)) return;

  const next = new Set(seen).add(model.id);
  const index = byId(models);
  const obj = value as Record<string, unknown>;

  for (const f of model.fields) {
    if (!f.name.trim()) continue;
    const raw = obj[f.name];
    if (raw === undefined) continue;

    collectQuoteExpr(fieldToTypeExpr(f), raw, models, index, out, next);
  }
}

export function collectQuotesForModel(
  value: unknown,
  model: StructureModel,
  models: StructureModel[],
  isList: boolean,
): LinkedQuoteValue[] {
  const out: LinkedQuoteValue[] = [];
  if (isList && Array.isArray(value)) {
    for (const row of value) collectQuotesOnRow(row, model, models, out, new Set());
  } else {
    collectQuotesOnRow(value, model, models, out, new Set());
  }
  return out;
}

// AI : dotted paths to every quote field — useful for inspectors and tests.
export function quoteFieldPaths(
  model: StructureModel,
  models: StructureModel[],
  prefix = "",
  seen: Set<StructureModelId> = new Set(),
): string[] {
  if (seen.has(model.id)) return [];
  const next = new Set(seen).add(model.id);
  const index = byId(models);
  const paths: string[] = [];

  for (const f of model.fields) {
    if (!f.name.trim()) continue;
    const path = prefix ? `${prefix}.${f.name}` : f.name;
    const expr = fieldToTypeExpr(f);
    if (typeExprIsQuote(expr)) {
      paths.push(path);
      continue;
    }
    paths.push(...quotePathsForExpr(expr, models, index, path, next));
  }
  return paths;
}
