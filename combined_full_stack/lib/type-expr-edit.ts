import type { PrimName, TypeExpr } from "@/lib/server/type_expr"
import { UNSET_TYPE_EXPR } from "@/lib/server/type_expr"
import type { StructureModel, StructureModelId } from "@/lib/types"

export type TypePath = number[]

export type TypeKindPick =
  | "unset"
  | "str"
  | "int"
  | "float"
  | "bool"
  | "datetime"
  | "json"
  | "document"
  | "quote"
  | "text_quote"
  | "list"
  | "dict"
  | "set"
  | "optional"
  | "tuple"
  | "union"
  | "named"
  | "model"

export const TYPE_KIND_OPTIONS: { id: TypeKindPick; label: string; hint?: string }[] = [
  { id: "list", label: "list[…]", hint: "Homogeneous sequence" },
  { id: "dict", label: "dict[K, V]", hint: "Key-value map" },
  { id: "set", label: "set[…]", hint: "Unique collection" },
  { id: "optional", label: "Optional[…]", hint: "May be absent" },
  { id: "tuple", label: "tuple[…]", hint: "Fixed-length product" },
  { id: "union", label: "A | B", hint: "One of several types" },
  { id: "str", label: "str" },
  { id: "int", label: "int" },
  { id: "float", label: "float" },
  { id: "bool", label: "bool" },
  { id: "datetime", label: "datetime" },
  { id: "json", label: "json" },
  { id: "document", label: "Document" },
  { id: "quote", label: "Quote" },
  { id: "text_quote", label: "TextQuote" },
  { id: "model", label: "Structure model" },
  { id: "named", label: "Custom name", hint: "e.g. quote_id_t" },
  { id: "unset", label: "UNSET", hint: "Placeholder slot" },
]

export function exprFromKindPick(
  pick: TypeKindPick,
  models: StructureModel[],
  modelId?: StructureModelId,
): TypeExpr {
  switch (pick) {
    case "unset":
      return UNSET_TYPE_EXPR
    case "str":
      return { kind: "prim", name: "text" }
    case "int":
      return { kind: "prim", name: "int" }
    case "float":
      return { kind: "prim", name: "float" }
    case "bool":
      return { kind: "prim", name: "bool" }
    case "datetime":
      return { kind: "prim", name: "datetime" }
    case "json":
      return { kind: "prim", name: "json" }
    case "document":
      return { kind: "document" }
    case "quote":
      return { kind: "quote" }
    case "text_quote":
      return { kind: "text_quote" }
    case "list":
      return { kind: "list", item: UNSET_TYPE_EXPR }
    case "dict":
      return { kind: "map", key: { kind: "prim", name: "text" }, value: UNSET_TYPE_EXPR }
    case "set":
      return { kind: "set", item: UNSET_TYPE_EXPR }
    case "optional":
      return { kind: "optional", inner: UNSET_TYPE_EXPR }
    case "tuple":
      return { kind: "generic", name: "tuple", args: [UNSET_TYPE_EXPR, UNSET_TYPE_EXPR] }
    case "union":
      return { kind: "union", variants: [UNSET_TYPE_EXPR, UNSET_TYPE_EXPR] }
    case "named":
      return { kind: "named", name: "quote_id_t" }
    case "model": {
      const id = modelId ?? (models[0]?.id as StructureModelId | undefined)
      return id ? { kind: "ref", modelId: id } : UNSET_TYPE_EXPR
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
    case "list":
    case "set":
    case "optional":
      return index === 0 ? slotOf(expr) : UNSET_TYPE_EXPR
    case "map":
      return index === 0 ? expr.key : index === 1 ? expr.value : UNSET_TYPE_EXPR
    case "union":
      return expr.variants[index] ?? UNSET_TYPE_EXPR
    case "generic":
      return expr.args[index] ?? UNSET_TYPE_EXPR
    default:
      return UNSET_TYPE_EXPR
  }
}

function slotOf(expr: TypeExpr): TypeExpr {
  if (expr.kind === "list" || expr.kind === "set") return expr.item
  if (expr.kind === "optional") return expr.inner
  return UNSET_TYPE_EXPR
}

function mapChild(expr: TypeExpr, index: number, fn: (child: TypeExpr) => TypeExpr): TypeExpr {
  switch (expr.kind) {
    case "list":
      return { ...expr, item: fn(expr.item) }
    case "set":
      return { ...expr, item: fn(expr.item) }
    case "optional":
      return { ...expr, inner: fn(expr.inner) }
    case "map":
      if (index === 0) return { ...expr, key: fn(expr.key) }
      if (index === 1) return { ...expr, value: fn(expr.value) }
      return expr
    case "union": {
      const variants = [...expr.variants]
      variants[index] = fn(variants[index] ?? UNSET_TYPE_EXPR)
      return { ...expr, variants }
    }
    case "generic": {
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
  if (target.kind !== "union") return root
  return setAtPath(root, path, { ...target, variants: [...target.variants, UNSET_TYPE_EXPR] })
}

export function appendTupleArg(root: TypeExpr, path: TypePath): TypeExpr {
  const target = getAtPath(root, path)
  if (target.kind !== "generic" || target.name !== "tuple") return root
  return setAtPath(root, path, { ...target, args: [...target.args, UNSET_TYPE_EXPR] })
}

export function removeChildAt(root: TypeExpr, path: TypePath, index: number): TypeExpr {
  const target = getAtPath(root, path)
  if (target.kind === "union" && target.variants.length > 2) {
    return setAtPath(root, path, {
      ...target,
      variants: target.variants.filter((_, i) => i !== index),
    })
  }
  if (target.kind === "generic" && target.name === "tuple" && target.args.length > 2) {
    return setAtPath(root, path, {
      ...target,
      args: target.args.filter((_, i) => i !== index),
    })
  }
  return root
}

export function childPaths(expr: TypeExpr, base: TypePath = []): { label: string; path: TypePath }[] {
  switch (expr.kind) {
    case "list":
    case "set":
      return [{ label: "item", path: [...base, 0] }]
    case "optional":
      return [{ label: "inner", path: [...base, 0] }]
    case "map":
      return [
        { label: "key", path: [...base, 0] },
        { label: "value", path: [...base, 1] },
      ]
    case "union":
      return expr.variants.map((_, i) => ({ label: `opt ${i + 1}`, path: [...base, i] }))
    case "generic":
      if (expr.name === "tuple") {
        return expr.args.map((_, i) => ({ label: `#${i + 1}`, path: [...base, i] }))
      }
      return expr.args.map((_, i) => ({ label: `arg ${i + 1}`, path: [...base, i] }))
    default:
      return []
  }
}

export function typeExprHasUnset(expr: TypeExpr): boolean {
  if (expr.kind === "unset") return true
  switch (expr.kind) {
    case "list":
    case "set":
      return typeExprHasUnset(expr.item)
    case "optional":
      return typeExprHasUnset(expr.inner)
    case "map":
      return typeExprHasUnset(expr.key) || typeExprHasUnset(expr.value)
    case "union":
      return expr.variants.some(typeExprHasUnset)
    case "generic":
      return expr.args.some(typeExprHasUnset)
    default:
      return false
  }
}
