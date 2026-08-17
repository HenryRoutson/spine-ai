import {
  PrimName,
  TypeExprKind,
  UNSET_TYPE_EXPR,
  type TypeExpr,
} from "@/lib/server/type_expr"
import { MarkupKind } from "@/lib/markup-kinds"
import type { StructureModel, StructureModelId } from "@/lib/types"
import { instantiateModelType } from "@/lib/type-params"

export type TypePath = number[]

// AI : UI picker ids — not identical to TypeExprKind (str/dict/tuple/model are editor affordances).
export const TypeKindPick = {
  Unset: "unset",
  Str: "str",
  Int: "int",
  Float: "float",
  Bool: "bool",
  Datetime: "datetime",
  Json: "json",
  Markdown: MarkupKind.Markdown,
  Latex: MarkupKind.Latex,
  Document: "document",
  Quote: "quote",
  TextQuote: "text_quote",
  List: "list",
  Dict: "dict",
  Set: "set",
  Optional: "optional",
  Tuple: "tuple",
  Union: "union",
  Named: "named",
  Model: "model",
} as const

export type TypeKindPick = (typeof TypeKindPick)[keyof typeof TypeKindPick]

export const TYPE_KIND_OPTIONS: { id: TypeKindPick; label: string; hint?: string }[] = [
  { id: TypeKindPick.List, label: "list[…]", hint: "Homogeneous sequence" },
  { id: TypeKindPick.Dict, label: "dict[K, V]", hint: "Key-value map" },
  { id: TypeKindPick.Set, label: "set[…]", hint: "Unique collection" },
  { id: TypeKindPick.Optional, label: "Optional[…]", hint: "May be absent" },
  { id: TypeKindPick.Tuple, label: "tuple[…]", hint: "Fixed-length product" },
  { id: TypeKindPick.Union, label: "A | B", hint: "One of several types" },
  { id: TypeKindPick.Str, label: "str" },
  { id: TypeKindPick.Int, label: "int" },
  { id: TypeKindPick.Float, label: "float" },
  { id: TypeKindPick.Bool, label: "bool" },
  { id: TypeKindPick.Datetime, label: "datetime" },
  { id: TypeKindPick.Json, label: "json" },
  { id: TypeKindPick.Markdown, label: "markdown", hint: "Validated GFM + math + mermaid" },
  { id: TypeKindPick.Latex, label: "latex", hint: "Validated TeX with package allowlist" },
  { id: TypeKindPick.Document, label: "Document" },
  { id: TypeKindPick.Quote, label: "Quote" },
  { id: TypeKindPick.TextQuote, label: "TextQuote" },
  { id: TypeKindPick.Model, label: "Structure model" },
  { id: TypeKindPick.Named, label: "Custom name", hint: "e.g. quote_id_t" },
  { id: TypeKindPick.Unset, label: "UNSET", hint: "Placeholder slot" },
]

export function exprFromKindPick(
  pick: TypeKindPick,
  models: StructureModel[],
  modelId?: StructureModelId,
): TypeExpr {
  switch (pick) {
    case TypeKindPick.Unset:
      return UNSET_TYPE_EXPR
    case TypeKindPick.Str:
      return { kind: TypeExprKind.Prim, name: PrimName.Text }
    case TypeKindPick.Int:
      return { kind: TypeExprKind.Prim, name: PrimName.Int }
    case TypeKindPick.Float:
      return { kind: TypeExprKind.Prim, name: PrimName.Float }
    case TypeKindPick.Bool:
      return { kind: TypeExprKind.Prim, name: PrimName.Bool }
    case TypeKindPick.Datetime:
      return { kind: TypeExprKind.Prim, name: PrimName.Datetime }
    case TypeKindPick.Json:
      return { kind: TypeExprKind.Prim, name: PrimName.Json }
    case TypeKindPick.Markdown:
      return { kind: TypeExprKind.Prim, name: PrimName.Markdown }
    case TypeKindPick.Latex:
      return { kind: TypeExprKind.Prim, name: PrimName.Latex }
    case TypeKindPick.Document:
      return { kind: TypeExprKind.Document }
    case TypeKindPick.Quote:
      return { kind: TypeExprKind.Quote }
    case TypeKindPick.TextQuote:
      return { kind: TypeExprKind.TextQuote }
    case TypeKindPick.List:
      return { kind: TypeExprKind.List, item: UNSET_TYPE_EXPR }
    case TypeKindPick.Dict:
      return {
        kind: TypeExprKind.Map,
        key: { kind: TypeExprKind.Prim, name: PrimName.Text },
        value: UNSET_TYPE_EXPR,
      }
    case TypeKindPick.Set:
      return { kind: TypeExprKind.Set, item: UNSET_TYPE_EXPR }
    case TypeKindPick.Optional:
      return { kind: TypeExprKind.Optional, inner: UNSET_TYPE_EXPR }
    case TypeKindPick.Tuple:
      return { kind: TypeExprKind.Generic, name: "tuple", args: [UNSET_TYPE_EXPR, UNSET_TYPE_EXPR] }
    case TypeKindPick.Union:
      return { kind: TypeExprKind.Union, variants: [UNSET_TYPE_EXPR, UNSET_TYPE_EXPR] }
    case TypeKindPick.Named:
      return { kind: TypeExprKind.Named, name: "quote_id_t" }
    case TypeKindPick.Model: {
      const id = modelId ?? (models[0]?.id as StructureModelId | undefined)
      if (!id) return UNSET_TYPE_EXPR
      const model = models.find((m) => m.id === id)
      return model ? instantiateModelType(model) : { kind: TypeExprKind.Ref, modelId: id }
    }
  }
}

export function getAtPath(root: TypeExpr, path: TypePath): TypeExpr {
  let cur = root
  for (const idx of path) {
    cur = childAt(cur, idx)
  }
  return cur
}

export function setAtPath(root: TypeExpr, path: TypePath, next: TypeExpr): TypeExpr {
  if (!path.length) return next
  const [head, ...rest] = path
  return mapChild(root, head, (child) => setAtPath(child, rest, next))
}

function childAt(expr: TypeExpr, index: number): TypeExpr {
  switch (expr.kind) {
    case TypeExprKind.List:
    case TypeExprKind.Set:
    case TypeExprKind.Optional:
      return index === 0 ? slotOf(expr) : UNSET_TYPE_EXPR
    case TypeExprKind.Map:
      return index === 0 ? expr.key : index === 1 ? expr.value : UNSET_TYPE_EXPR
    case TypeExprKind.Union:
      return expr.variants[index] ?? UNSET_TYPE_EXPR
    case TypeExprKind.Generic:
      return expr.args[index] ?? UNSET_TYPE_EXPR
    case TypeExprKind.Ref:
      return expr.args?.[index] ?? UNSET_TYPE_EXPR
    default:
      return UNSET_TYPE_EXPR
  }
}

function slotOf(expr: TypeExpr): TypeExpr {
  if (expr.kind === TypeExprKind.List || expr.kind === TypeExprKind.Set) return expr.item
  if (expr.kind === TypeExprKind.Optional) return expr.inner
  return UNSET_TYPE_EXPR
}

function mapChild(expr: TypeExpr, index: number, fn: (child: TypeExpr) => TypeExpr): TypeExpr {
  switch (expr.kind) {
    case TypeExprKind.List:
      return { ...expr, item: fn(expr.item) }
    case TypeExprKind.Set:
      return { ...expr, item: fn(expr.item) }
    case TypeExprKind.Optional:
      return { ...expr, inner: fn(expr.inner) }
    case TypeExprKind.Map:
      if (index === 0) return { ...expr, key: fn(expr.key) }
      if (index === 1) return { ...expr, value: fn(expr.value) }
      return expr
    case TypeExprKind.Union: {
      const variants = [...expr.variants]
      variants[index] = fn(variants[index] ?? UNSET_TYPE_EXPR)
      return { ...expr, variants }
    }
    case TypeExprKind.Generic: {
      const args = [...expr.args]
      args[index] = fn(args[index] ?? UNSET_TYPE_EXPR)
      return { ...expr, args }
    }
    case TypeExprKind.Ref: {
      if (!expr.args?.length) return expr
      const args = [...expr.args]
      args[index] = fn(args[index] ?? UNSET_TYPE_EXPR)
      return { ...expr, args }
    }
    default:
      return expr
  }
}

export function appendUnionVariant(root: TypeExpr, path: TypePath): TypeExpr {
  const target = getAtPath(root, path)
  if (target.kind !== TypeExprKind.Union) return root
  return setAtPath(root, path, { ...target, variants: [...target.variants, UNSET_TYPE_EXPR] })
}

export function appendTupleArg(root: TypeExpr, path: TypePath): TypeExpr {
  const target = getAtPath(root, path)
  if (target.kind !== TypeExprKind.Generic || target.name !== "tuple") return root
  return setAtPath(root, path, { ...target, args: [...target.args, UNSET_TYPE_EXPR] })
}

export function removeChildAt(root: TypeExpr, path: TypePath, index: number): TypeExpr {
  const target = getAtPath(root, path)
  if (target.kind === TypeExprKind.Union && target.variants.length > 2) {
    return setAtPath(root, path, {
      ...target,
      variants: target.variants.filter((_, i) => i !== index),
    })
  }
  if (target.kind === TypeExprKind.Generic && target.name === "tuple" && target.args.length > 2) {
    return setAtPath(root, path, {
      ...target,
      args: target.args.filter((_, i) => i !== index),
    })
  }
  return root
}

export function childPaths(
  expr: TypeExpr,
  base: TypePath = [],
  paramNames?: readonly string[],
): { label: string; path: TypePath }[] {
  switch (expr.kind) {
    case TypeExprKind.List:
    case TypeExprKind.Set:
      return [{ label: "item", path: [...base, 0] }]
    case TypeExprKind.Optional:
      return [{ label: "inner", path: [...base, 0] }]
    case TypeExprKind.Map:
      return [
        { label: "key", path: [...base, 0] },
        { label: "value", path: [...base, 1] },
      ]
    case TypeExprKind.Union:
      return expr.variants.map((_, i) => ({ label: `opt ${i + 1}`, path: [...base, i] }))
    case TypeExprKind.Generic:
      if (expr.name === "tuple") {
        return expr.args.map((_, i) => ({ label: `#${i + 1}`, path: [...base, i] }))
      }
      return expr.args.map((_, i) => ({ label: paramNames?.[i] ?? `arg ${i + 1}`, path: [...base, i] }))
    case TypeExprKind.Ref:
      return (expr.args ?? []).map((_, i) => ({
        label: paramNames?.[i] ?? `arg ${i + 1}`,
        path: [...base, i],
      }))
    default:
      return []
  }
}

export function typeExprHasUnset(expr: TypeExpr): boolean {
  if (expr.kind === TypeExprKind.Unset) return true
  switch (expr.kind) {
    case TypeExprKind.List:
    case TypeExprKind.Set:
      return typeExprHasUnset(expr.item)
    case TypeExprKind.Optional:
      return typeExprHasUnset(expr.inner)
    case TypeExprKind.Map:
      return typeExprHasUnset(expr.key) || typeExprHasUnset(expr.value)
    case TypeExprKind.Union:
      return expr.variants.some(typeExprHasUnset)
    case TypeExprKind.Generic:
      return expr.args.some(typeExprHasUnset)
    case TypeExprKind.Ref:
      return (expr.args ?? []).some(typeExprHasUnset)
    default:
      return false
  }
}
