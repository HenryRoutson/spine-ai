import type { DocId, FieldType, ModelField, StructureModel, StructureModelId } from "./types";

// AI : schema-driven quote handling — follow StructureModel refs to find/link spans; no JSON brute-force.

export type LinkedQuoteValue = {
  text: string;
  quote: { doc_id: DocId; start: number; end: number };
};

export type QuoteLinker = (verbatim: string) => LinkedQuoteValue;

function byId(models: StructureModel[]): Map<StructureModelId, StructureModel> {
  return new Map(models.map((m) => [m.id, m]));
}

function isQuoteFieldType(type: FieldType): boolean {
  return type === "tuple[text,quote]" || type === "list[tuple[text,quote]]";
}

function refModel(
  field: ModelField,
  index: Map<StructureModelId, StructureModel>,
): StructureModel | undefined {
  return field.ref ? index.get(field.ref) : undefined;
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
    if (isQuoteFieldType(f.type)) return true;
    if (f.type === "model") {
      const ref = refModel(f, index);
      if (ref && modelHasQuoteFields(ref, models, next)) return true;
    }
    if (f.type === "list[model]") {
      const ref = refModel(f, index);
      if (ref && modelHasQuoteFields(ref, models, next)) return true;
    }
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

    switch (f.type) {
      case "tuple[text,quote]":
        out[f.name] = linkQuoteField(raw, link);
        break;
      case "list[tuple[text,quote]]":
        out[f.name] = linkQuoteList(raw, link);
        break;
      case "model": {
        const ref = refModel(f, index);
        if (ref) out[f.name] = resolveQuotesOnRow(raw, ref, models, link, next);
        break;
      }
      case "list[model]": {
        const ref = refModel(f, index);
        if (ref && Array.isArray(raw)) {
          out[f.name] = raw.map((row) => resolveQuotesOnRow(row, ref, models, link, next));
        }
        break;
      }
    }
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

    switch (f.type) {
      case "tuple[text,quote]":
        pushLinkedQuote(raw, out);
        break;
      case "list[tuple[text,quote]]":
        if (Array.isArray(raw)) for (const item of raw) pushLinkedQuote(item, out);
        break;
      case "model": {
        const ref = refModel(f, index);
        if (ref) collectQuotesOnRow(raw, ref, models, out, next);
        break;
      }
      case "list[model]": {
        const ref = refModel(f, index);
        if (ref && Array.isArray(raw)) {
          for (const row of raw) collectQuotesOnRow(row, ref, models, out, next);
        }
        break;
      }
    }
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
    if (isQuoteFieldType(f.type)) {
      paths.push(path);
      continue;
    }
    if (f.type === "model") {
      const ref = refModel(f, index);
      if (ref) paths.push(...quoteFieldPaths(ref, models, path, next));
    }
    if (f.type === "list[model]") {
      const ref = refModel(f, index);
      if (ref) paths.push(...quoteFieldPaths(ref, models, `${path}[]`, next));
    }
  }
  return paths;
}
