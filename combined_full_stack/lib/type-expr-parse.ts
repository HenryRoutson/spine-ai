import { fieldToTypeExpr, PrimName, TypeExprKind, type TypeExpr } from "@/lib/server/type_expr"
import { BUILTIN_QUOTE_SPAN_ID } from "@/lib/server/builtin_models"
import { FieldType } from "@/lib/types"
import type { StructureModel, StructureModelId } from "@/lib/types"

const PRIM_ALIASES: Record<string, PrimName> = {
  text: PrimName.Text,
  str: PrimName.Text,
  string: PrimName.Text,
  int: PrimName.Int,
  float: PrimName.Float,
  bool: PrimName.Bool,
  datetime: PrimName.Datetime,
  json: PrimName.Json,
  markdown: PrimName.Markdown,
  md: PrimName.Markdown,
  latex: PrimName.Latex,
  tex: PrimName.Latex,
}

// AI : split on a separator at bracket depth 0 — supports nested list[tuple[A, B]].
function splitTopLevel(source: string, sep: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === "[" || ch === "(") depth++
    else if (ch === "]" || ch === ")") depth = Math.max(0, depth - 1)
    else if (depth === 0 && source.slice(i, i + sep.length) === sep) {
      parts.push(source.slice(start, i).trim())
      start = i + sep.length
      i += sep.length - 1
    }
  }
  parts.push(source.slice(start).trim())
  return parts.filter(Boolean)
}

function modelByName(models: StructureModel[], name: string): StructureModel | undefined {
  return models.find((m) => m.name === name)
}

function parseIdentifier(raw: string, models: StructureModel[]): TypeExpr {
  const id = raw.trim()
  if (!id) throw new Error("Empty type name")

  const prim = PRIM_ALIASES[id.toLowerCase()]
  if (prim) return { kind: TypeExprKind.Prim, name: prim }
  if (id === "Document") return { kind: TypeExprKind.Document }
  if (id === "quote_string_t") return { kind: TypeExprKind.Quote }
  if (id.toLowerCase() === "quote") return { kind: TypeExprKind.Quote }
  if (id === "Quote") return { kind: TypeExprKind.Quote }
  if (id === "text_quote_t") return { kind: TypeExprKind.TextQuote }
  if (id === "TextQuote") return { kind: TypeExprKind.TextQuote }
  if (id === "quote_span_t" || id === "QuoteSpan") {
    return { kind: TypeExprKind.Ref, modelId: BUILTIN_QUOTE_SPAN_ID }
  }
  if (id === "UNSET") return { kind: TypeExprKind.Unset }

  const hit = modelByName(models, id)
  if (hit) return { kind: TypeExprKind.Ref, modelId: hit.id as StructureModelId }

  return { kind: TypeExprKind.Named, name: id }
}

function parseGeneric(name: string, argsStr: string, models: StructureModel[]): TypeExpr {
  const args = splitTopLevel(argsStr, ",").map((part) => parseTypeExprString(part, models))
  const lower = name.toLowerCase()

  if (lower === "list") {
    if (args.length !== 1) throw new Error("list[T] takes one type argument")
    return { kind: TypeExprKind.List, item: args[0]! }
  }
  if (lower === "set") {
    if (args.length !== 1) throw new Error("set[T] takes one type argument")
    return { kind: TypeExprKind.Set, item: args[0]! }
  }
  if (lower === "optional") {
    if (args.length !== 1) throw new Error("Optional[T] takes one type argument")
    return { kind: TypeExprKind.Optional, inner: args[0]! }
  }
  if (lower === "tuple") {
    if (args.length < 2) throw new Error("tuple needs at least two element types")
    return { kind: TypeExprKind.Generic, name: "tuple", args }
  }
  if (lower === "dict" || lower === "map") {
    if (args.length !== 2) throw new Error("dict[K, V] needs key and value types")
    return { kind: TypeExprKind.Map, key: args[0]!, value: args[1]! }
  }
  if (lower === "union") {
    if (args.length < 2) throw new Error("Union needs at least two variants")
    return { kind: TypeExprKind.Union, variants: args }
  }

  const model = modelByName(models, name)
  if (model) {
    if (model.params?.length) {
      if (args.length !== model.params.length) {
        throw new Error(`${name} expects ${model.params.length} type argument(s)`)
      }
      return { kind: TypeExprKind.Ref, modelId: model.id as StructureModelId, args }
    }
    if (args.length === 0) return { kind: TypeExprKind.Ref, modelId: model.id as StructureModelId }
  }

  return { kind: TypeExprKind.Generic, name, args }
}

function parsePrimary(source: string, models: StructureModel[]): TypeExpr {
  const s = source.trim()
  if (!s) throw new Error("Empty type expression")

  const optionalMatch = /^(Optional|optional)\[([\s\S]+)\]$/.exec(s)
  if (optionalMatch) {
    return { kind: TypeExprKind.Optional, inner: parseTypeExprString(optionalMatch[2]!.trim(), models) }
  }

  const unionMatch = /^Union\[([\s\S]+)\]$/.exec(s)
  if (unionMatch) {
    const variants = splitTopLevel(unionMatch[1]!, ",").map((part) => parseTypeExprString(part, models))
    if (variants.length < 2) throw new Error("Union needs at least two variants")
    return { kind: TypeExprKind.Union, variants }
  }

  const bracket = s.indexOf("[")
  if (bracket > 0 && s.endsWith("]")) {
    const name = s.slice(0, bracket).trim()
    const argsStr = s.slice(bracket + 1, -1)
    return parseGeneric(name, argsStr, models)
  }

  return parseIdentifier(s, models)
}

// AI : parse Python-style type strings into TypeExpr — list[T], tuple[A, B], Optional[Model], A | B.
export function parseTypeExprString(source: string, models: StructureModel[]): TypeExpr {
  const trimmed = source.trim()
  if (!trimmed) throw new Error("Type expression required")

  if (trimmed.includes("|")) {
    const variants = splitTopLevel(trimmed, "|").map((part) => parsePrimary(part, models))
    if (variants.length < 2) throw new Error("Union needs at least two variants")
    return { kind: TypeExprKind.Union, variants }
  }

  return parsePrimary(trimmed, models)
}

export function tryParseTypeExprString(
  source: string,
  models: StructureModel[],
): { ok: true; expr: TypeExpr } | { ok: false; error: string } {
  try {
    return { ok: true, expr: parseTypeExprString(source, models) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid type expression" }
  }
}

export function formatTypeExprPy(expr: TypeExpr, models: StructureModel[] = []): string {
  switch (expr.kind) {
    case TypeExprKind.Prim:
      return expr.name === PrimName.Text ? "str" : expr.name
    case TypeExprKind.Document:
      return "Document"
    case TypeExprKind.Quote:
      return "quote_string_t"
    case TypeExprKind.TextQuote:
      return "text_quote_t"
    case TypeExprKind.List:
      return `list[${formatTypeExprPy(expr.item, models)}]`
    case TypeExprKind.Ref: {
      const name = models.find((m) => m.id === expr.modelId)?.name ?? String(expr.modelId)
      if (!expr.args?.length) return name
      return `${name}[${expr.args.map((a) => formatTypeExprPy(a, models)).join(", ")}]`
    }
    case TypeExprKind.Optional:
      return `Optional[${formatTypeExprPy(expr.inner, models)}]`
    case TypeExprKind.Set:
      return `set[${formatTypeExprPy(expr.item, models)}]`
    case TypeExprKind.Map:
      return `dict[${formatTypeExprPy(expr.key, models)}, ${formatTypeExprPy(expr.value, models)}]`
    case TypeExprKind.Union:
      return expr.variants.map((v) => formatTypeExprPy(v, models)).join(" | ")
    case TypeExprKind.Generic:
      if (expr.name === "tuple") {
        return `tuple[${expr.args.map((a) => formatTypeExprPy(a, models)).join(", ")}]`
      }
      return expr.args.length
        ? `${expr.name}[${expr.args.map((a) => formatTypeExprPy(a, models)).join(", ")}]`
        : expr.name
    case TypeExprKind.Named:
      return expr.name
    case TypeExprKind.Unset:
      return "UNSET"
    case TypeExprKind.File:
      return "FileInput"
    case TypeExprKind.Unknown:
      return "Any"
    default:
      return "Any"
  }
}

// AI : map simple TypeExpr shapes back to legacy FieldType + ref for older code paths.
export function legacyFieldFromTypeExpr(
  expr: TypeExpr,
): { type: FieldType; ref?: StructureModelId } | null {
  switch (expr.kind) {
    case TypeExprKind.Prim:
      if (expr.name === PrimName.Json) return { type: FieldType.Json }
      if (expr.name === PrimName.Text) return { type: FieldType.Text }
      if (expr.name === PrimName.Markdown) return { type: FieldType.Text }
      if (expr.name === PrimName.Latex) return { type: FieldType.Text }
      if (expr.name === PrimName.Int) return { type: FieldType.Int }
      if (expr.name === PrimName.Float) return { type: FieldType.Float }
      if (expr.name === PrimName.Bool) return { type: FieldType.Bool }
      if (expr.name === PrimName.Datetime) return { type: FieldType.Datetime }
      return null
    case TypeExprKind.Document:
      return { type: FieldType.Document }
    case TypeExprKind.TextQuote:
      return { type: FieldType.TupleTextQuote }
    case TypeExprKind.List:
      if (expr.item.kind === TypeExprKind.TextQuote) return { type: FieldType.ListTupleTextQuote }
      if (expr.item.kind === TypeExprKind.Document) return { type: FieldType.ListDocument }
      if (expr.item.kind === TypeExprKind.Prim && expr.item.name === PrimName.Text) return { type: FieldType.ListText }
      if (expr.item.kind === TypeExprKind.Ref) return { type: FieldType.ListModel, ref: expr.item.modelId }
      return null
    case TypeExprKind.Ref:
      return { type: FieldType.Model, ref: expr.modelId }
    default:
      return null
  }
}

export function fieldTypeExprSource(
  field: import("@/lib/types").ModelFieldTypeSourcePick,
  models: StructureModel[],
): string {
  return formatTypeExprPy(fieldToTypeExpr(field), models)
}
