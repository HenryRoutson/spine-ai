// AI : type-param substitution, path typing, and assignability (assemble stages B–D).
// AI : TODO (type-join) — Pick/Omit/extend assignability: a prompt view must be a projection/join of the
// AI :   item type, never an arbitrary reshape. Lookup-embed: leftPath + leftKey ⋈ state[label] on rightKey
// AI :   → intersect item with { embedAs: Right }. Assemble/combine stay product-zip, not FK resolve.
// AI : TODO (sql-schema) — assignability of a prompt view is "SELECT list is a projection of the table".
// AI :   FK resolve is JOIN. Keep assemble/combine as product-zip of documents until those values are tables.
import {
  expandNamedTypeExpr,
  fieldToTypeExpr,
  typeExprEqual,
  TypeExprKind,
  type TypeExpr,
} from "@/lib/server/type_expr"
import type { StructureModel, StructureModelId, TypeAlias } from "@/lib/types"
import { withBuiltinTypeAliases } from "@/lib/server/builtin_types"

export type type_param_name = string

export function readDotPathValue(value: unknown, path: string): unknown {
  const parts = path.split(".").map((p) => p.trim()).filter(Boolean)
  let cur: unknown = value
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

export function substituteTypeParams(
  expr: TypeExpr,
  binding: Record<type_param_name, TypeExpr>,
): TypeExpr {
  const key = (name: string) => name.trim()
  function walk(e: TypeExpr): TypeExpr {
    if (e.kind === TypeExprKind.Named) {
      const hit = binding[key(e.name)]
      return hit ? walk(hit) : e
    }
    switch (e.kind) {
      case TypeExprKind.List:
      case TypeExprKind.Set:
        return { ...e, item: walk(e.item) }
      case TypeExprKind.Optional:
        return { ...e, inner: walk(e.inner) }
      case TypeExprKind.Map:
        return { ...e, key: walk(e.key), value: walk(e.value) }
      case TypeExprKind.Union:
        return { ...e, variants: e.variants.map(walk) }
      case TypeExprKind.Generic:
        return { ...e, args: e.args.map(walk) }
      case TypeExprKind.Ref:
        return e.args?.length ? { ...e, args: e.args.map(walk) } : e
      default:
        return e
    }
  }
  return walk(expr)
}

function aliasByName(aliases: TypeAlias[], name: string): TypeAlias | undefined {
  const key = name.trim().toLowerCase()
  return withBuiltinTypeAliases(aliases).find((t) => t.name.trim().toLowerCase() === key)
}

function modelById(models: StructureModel[], id: StructureModelId): StructureModel | undefined {
  return models.find((m) => m.id === id)
}

function modelByName(models: StructureModel[], name: string): StructureModel | undefined {
  return models.find((m) => m.name === name)
}

// AI : expand named aliases, parametric alias generics, and Ref[args] structure params.
export function expandTypeExprFull(
  expr: TypeExpr,
  models: StructureModel[] = [],
  typeAliases: TypeAlias[] = [],
  seen = new Set<string>(),
): TypeExpr {
  const e0 = expandNamedTypeExpr(expr, typeAliases)

  if (e0.kind === TypeExprKind.Generic) {
    const alias = aliasByName(typeAliases, e0.name)
    if (alias?.params?.length && alias.params.length === e0.args.length) {
      const mark = `alias:${alias.name}:${e0.args.map((a) => JSON.stringify(a)).join(",")}`
      if (!seen.has(mark)) {
        seen.add(mark)
        const binding: Record<string, TypeExpr> = {}
        alias.params.forEach((p, i) => {
          binding[p] = expandTypeExprFull(e0.args[i]!, models, typeAliases, seen)
        })
        return expandTypeExprFull(substituteTypeParams(alias.expr, binding), models, typeAliases, seen)
      }
    }
    const model = modelByName(models, e0.name)
    if (model?.params?.length && model.params.length === e0.args.length) {
      return expandTypeExprFull(
        { kind: TypeExprKind.Ref, modelId: model.id, args: e0.args },
        models,
        typeAliases,
        seen,
      )
    }
    return { ...e0, args: e0.args.map((a) => expandTypeExprFull(a, models, typeAliases, seen)) }
  }

  if (e0.kind === TypeExprKind.Ref && e0.args?.length) {
    const model = modelById(models, e0.modelId)
    if (model?.params?.length && model.params.length === e0.args.length) {
      const mark = `ref:${model.id}:${e0.args.map((a) => JSON.stringify(a)).join(",")}`
      if (seen.has(mark)) return e0
      seen.add(mark)
      const binding: Record<string, TypeExpr> = {}
      model.params.forEach((p, i) => {
        binding[p] = expandTypeExprFull(e0.args![i]!, models, typeAliases, seen)
      })
      // AI : structural product of substituted fields — not a new persisted model id.
      return {
        kind: TypeExprKind.Generic,
        name: `__struct_${model.name}`,
        args: model.fields
          .filter((f) => f.name.trim())
          .map((f) => ({
            kind: TypeExprKind.Generic,
            name: f.name,
            args: [expandTypeExprFull(substituteTypeParams(fieldToTypeExpr(f), binding), models, typeAliases, seen)],
          })),
      }
    }
  }

  switch (e0.kind) {
    case TypeExprKind.List:
    case TypeExprKind.Set:
      return { ...e0, item: expandTypeExprFull(e0.item, models, typeAliases, seen) }
    case TypeExprKind.Optional:
      return { ...e0, inner: expandTypeExprFull(e0.inner, models, typeAliases, seen) }
    case TypeExprKind.Map:
      return {
        ...e0,
        key: expandTypeExprFull(e0.key, models, typeAliases, seen),
        value: expandTypeExprFull(e0.value, models, typeAliases, seen),
      }
    case TypeExprKind.Union:
      return { ...e0, variants: e0.variants.map((v) => expandTypeExprFull(v, models, typeAliases, seen)) }
    case TypeExprKind.Ref:
      return e0.args?.length
        ? { ...e0, args: e0.args.map((a) => expandTypeExprFull(a, models, typeAliases, seen)) }
        : e0
    default:
      return e0
  }
}

export function typeExprAtPath(
  root: TypeExpr,
  path: string,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): TypeExpr | undefined {
  const parts = path.split(".").map((p) => p.trim()).filter(Boolean)
  let cur = expandTypeExprFull(root, models, typeAliases)
  for (const part of parts) {
    cur = expandTypeExprFull(cur, models, typeAliases)
    if (cur.kind === TypeExprKind.Optional) cur = cur.inner
    if (cur.kind === TypeExprKind.Ref && !cur.args?.length) {
      const model = modelById(models, cur.modelId)
      if (!model) return undefined
      const field = model.fields.find((f) => f.name === part)
      if (!field) return undefined
      cur = fieldToTypeExpr(field)
      continue
    }
    // AI : expanded parametric struct as Generic __struct_Name with field generics.
    if (cur.kind === TypeExprKind.Generic && cur.name.startsWith("__struct_")) {
      const fieldArg = cur.args.find((a) => a.kind === TypeExprKind.Generic && a.name === part)
      if (!fieldArg || fieldArg.kind !== TypeExprKind.Generic || !fieldArg.args[0]) return undefined
      cur = fieldArg.args[0]
      continue
    }
    return undefined
  }
  return cur
}

// AI : Stage B — optional widen, list covariance, union membership, unknown.
export function typeExprAssignable(
  expected: TypeExpr,
  actual: TypeExpr,
  typeAliases: TypeAlias[] = [],
  models: StructureModel[] = [],
): boolean {
  const e = expandTypeExprFull(expected, models, typeAliases)
  const a = expandTypeExprFull(actual, models, typeAliases)
  if (typeExprEqual(e, a)) return true
  if (e.kind === TypeExprKind.Unknown || a.kind === TypeExprKind.Unknown) return true
  if (e.kind === TypeExprKind.Optional && typeExprAssignable(e.inner, a, typeAliases, models)) return true
  if (a.kind === TypeExprKind.Optional && typeExprAssignable(e, a.inner, typeAliases, models)) return true
  if (e.kind === TypeExprKind.List && a.kind === TypeExprKind.List) {
    return typeExprAssignable(e.item, a.item, typeAliases, models)
  }
  if (e.kind === TypeExprKind.Set && a.kind === TypeExprKind.Set) {
    return typeExprAssignable(e.item, a.item, typeAliases, models)
  }
  if (e.kind === TypeExprKind.Union) {
    return e.variants.some((v) => typeExprAssignable(v, a, typeAliases, models))
  }
  if (a.kind === TypeExprKind.Union) {
    return a.variants.every((v) => typeExprAssignable(e, v, typeAliases, models))
  }
  if (e.kind === TypeExprKind.Ref && a.kind === TypeExprKind.Ref) {
    if (e.modelId !== a.modelId) return false
    const eArgs = e.args ?? []
    const aArgs = a.args ?? []
    if (eArgs.length !== aArgs.length) return eArgs.length === 0 && aArgs.length === 0
    return eArgs.every((arg, i) => typeExprAssignable(arg, aArgs[i]!, typeAliases, models))
  }
  return false
}

// AI : Stage E — TS generic signature when assemble out is Pair[A,B]-style alias instantiation.
export function assemblePolymorphicTsSignature(
  outType: TypeExpr | undefined,
  bindings: Record<string, { kind: string }>,
  typeAliases: TypeAlias[],
): string | undefined {
  if (!outType || outType.kind !== TypeExprKind.Generic) return undefined
  const alias = aliasByName(typeAliases, outType.name)
  if (!alias?.params?.length || alias.params.length !== outType.args.length) return undefined
  const params = alias.params.join(", ")
  const fields = Object.keys(bindings)
    .map((name, i) => `${name}: ${alias.params![i] ?? "unknown"}`)
    .join("; ")
  // AI : only emit when field count matches type params (Pair-shaped assemble).
  if (fields.split(";").length !== alias.params.length) {
    const fieldEntries = Object.keys(bindings)
    if (fieldEntries.length !== alias.params.length) return undefined
  }
  return `<${params}>(input: unknown, state: Record<string, unknown>): { ${Object.keys(bindings)
    .map((name, i) => `${JSON.stringify(name)}: ${alias.params![i] ?? "unknown"}`)
    .join("; ")} }`
}
