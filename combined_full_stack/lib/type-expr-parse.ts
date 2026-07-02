import { fieldToTypeExpr } from "@/lib/server/type_expr"
import type { PrimName, TypeExpr } from "@/lib/server/type_expr"
import type { StructureModel, StructureModelId } from "@/lib/types"

const PRIM_ALIASES: Record<string, PrimName> = {
  text: "text",
  str: "text",
  string: "text",
  int: "int",
  float: "float",
  bool: "bool",
  datetime: "datetime",
  json: "json",
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
  if (prim) return { kind: "prim", name: prim }
  if (id === "Document") return { kind: "document" }
  if (id === "Quote") return { kind: "quote" }
  if (id === "TextQuote") return { kind: "text_quote" }
  if (id === "UNSET") return { kind: "unset" }

  const hit = modelByName(models, id)
  if (hit) return { kind: "ref", modelId: hit.id as StructureModelId }

  return { kind: "named", name: id }
}

function parseGeneric(name: string, argsStr: string, models: StructureModel[]): TypeExpr {
  const args = splitTopLevel(argsStr, ",").map((part) => parseTypeExprString(part, models))
  const lower = name.toLowerCase()

  if (lower === "list") {
    if (args.length !== 1) throw new Error("list[T] takes one type argument")
    return { kind: "list", item: args[0]! }
  }
  if (lower === "set") {
    if (args.length !== 1) throw new Error("set[T] takes one type argument")
    return { kind: "set", item: args[0]! }
  }
  if (lower === "optional") {
    if (args.length !== 1) throw new Error("Optional[T] takes one type argument")
    return { kind: "optional", inner: args[0]! }
  }
  if (lower === "tuple") {
    if (args.length < 2) throw new Error("tuple needs at least two element types")
    return { kind: "generic", name: "tuple", args }
  }
  if (lower === "dict" || lower === "map") {
    if (args.length !== 2) throw new Error("dict[K, V] needs key and value types")
    return { kind: "map", key: args[0]!, value: args[1]! }
  }
  if (lower === "union") {
    if (args.length < 2) throw new Error("Union needs at least two variants")
    return { kind: "union", variants: args }
  }

  const model = modelByName(models, name)
  if (model && args.length === 0) return { kind: "ref", modelId: model.id as StructureModelId }

  return { kind: "generic", name, args }
}

function parsePrimary(source: string, models: StructureModel[]): TypeExpr {
  const s = source.trim()
  if (!s) throw new Error("Empty type expression")

  const optionalMatch = /^(Optional|optional)\[([\s\S]+)\]$/.exec(s)
  if (optionalMatch) {
    return { kind: "optional", inner: parseTypeExprString(optionalMatch[2]!.trim(), models) }
  }

  const unionMatch = /^Union\[([\s\S]+)\]$/.exec(s)
  if (unionMatch) {
    const variants = splitTopLevel(unionMatch[1]!, ",").map((part) => parseTypeExprString(part, models))
    if (variants.length < 2) throw new Error("Union needs at least two variants")
    return { kind: "union", variants }
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
    return { kind: "union", variants }
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
    case "prim":
      return expr.name === "text" ? "str" : expr.name
    case "document":
      return "Document"
    case "quote":
      return "Quote"
    case "text_quote":
      return "TextQuote"
    case "list":
      return `list[${formatTypeExprPy(expr.item, models)}]`
    case "ref": {
      const name = models.find((m) => m.id === expr.modelId)?.name
      return name ?? String(expr.modelId)
    }
    case "optional":
      return `Optional[${formatTypeExprPy(expr.inner, models)}]`
    case "set":
      return `set[${formatTypeExprPy(expr.item, models)}]`
    case "map":
      return `dict[${formatTypeExprPy(expr.key, models)}, ${formatTypeExprPy(expr.value, models)}]`
    case "union":
      return expr.variants.map((v) => formatTypeExprPy(v, models)).join(" | ")
    case "generic":
      if (expr.name === "tuple") {
        return `tuple[${expr.args.map((a) => formatTypeExprPy(a, models)).join(", ")}]`
      }
      return expr.args.length
        ? `${expr.name}[${expr.args.map((a) => formatTypeExprPy(a, models)).join(", ")}]`
        : expr.name
    case "named":
      return expr.name
    case "unset":
      return "UNSET"
    case "file":
      return "FileInput"
    case "unknown":
      return "Any"
    default:
      return "Any"
  }
}

// AI : map simple TypeExpr shapes back to legacy FieldType + ref for older code paths.
export function legacyFieldFromTypeExpr(
  expr: TypeExpr,
): { type: import("@/lib/types").FieldType; ref?: StructureModelId } | null {
  switch (expr.kind) {
    case "prim":
      if (expr.name === "json") return { type: "json" }
      if (expr.name === "text") return { type: "text" }
      if (expr.name === "int") return { type: "int" }
      if (expr.name === "float") return { type: "float" }
      if (expr.name === "bool") return { type: "bool" }
      if (expr.name === "datetime") return { type: "datetime" }
      return null
    case "document":
      return { type: "document" }
    case "text_quote":
      return { type: "tuple[text,quote]" }
    case "list":
      if (expr.item.kind === "text_quote") return { type: "list[tuple[text,quote]]" }
      if (expr.item.kind === "document") return { type: "list[document]" }
      if (expr.item.kind === "prim" && expr.item.name === "text") return { type: "list[text]" }
      if (expr.item.kind === "ref") return { type: "list[model]", ref: expr.item.modelId }
      return null
    case "ref":
      return { type: "model", ref: expr.modelId }
    default:
      return null
  }
}

export function fieldTypeExprSource(
  field: Pick<import("@/lib/types").ModelField, "type" | "ref" | "typeExpr">,
  models: StructureModel[],
): string {
  return formatTypeExprPy(fieldToTypeExpr(field), models)
}
