// AI : typed if/else predicates — kind is picked from the spine field TypeExpr; loops stay in code.
import { z } from "zod"
import { IfConditionKind, type IfCondition } from "@/lib/types"
import { PrimName, TypeExprKind, type TypeExpr } from "@/lib/server/type_expr"
import { readDotPathValue } from "@/lib/type-expr-polymorph"

export const IF_CONDITION_KINDS = [
  IfConditionKind.Path,
  IfConditionKind.Equals,
  IfConditionKind.NotEquals,
  IfConditionKind.Gt,
  IfConditionKind.Gte,
  IfConditionKind.Lt,
  IfConditionKind.Lte,
  IfConditionKind.Exists,
  IfConditionKind.Empty,
  IfConditionKind.Contains,
  IfConditionKind.In,
  IfConditionKind.Truthy,
] as const

export type IfConditionKindId = (typeof IF_CONDITION_KINDS)[number]

const KIND_ALIASES: Record<string, IfConditionKind> = {
  path: IfConditionKind.Path,
  bool: IfConditionKind.Path,
  equals: IfConditionKind.Equals,
  eq: IfConditionKind.Equals,
  "not-equals": IfConditionKind.NotEquals,
  ne: IfConditionKind.NotEquals,
  neq: IfConditionKind.NotEquals,
  gt: IfConditionKind.Gt,
  gte: IfConditionKind.Gte,
  lt: IfConditionKind.Lt,
  lte: IfConditionKind.Lte,
  ">": IfConditionKind.Gt,
  ">=": IfConditionKind.Gte,
  "<": IfConditionKind.Lt,
  "<=": IfConditionKind.Lte,
  exists: IfConditionKind.Exists,
  empty: IfConditionKind.Empty,
  contains: IfConditionKind.Contains,
  in: IfConditionKind.In,
  truthy: IfConditionKind.Truthy,
}

export const IF_CONDITION_KIND_META: Record<
  IfConditionKind,
  { label: string; hint: string; needsValue: boolean }
> = {
  [IfConditionKind.Path]: { label: "bool path", hint: "spine field is true", needsValue: false },
  [IfConditionKind.Equals]: { label: "equals", hint: "JSON-equal to a literal", needsValue: true },
  [IfConditionKind.NotEquals]: { label: "not equals", hint: "not JSON-equal to a literal", needsValue: true },
  [IfConditionKind.Gt]: { label: "greater than", hint: "number > literal", needsValue: true },
  [IfConditionKind.Gte]: { label: "greater or equal", hint: "number ≥ literal", needsValue: true },
  [IfConditionKind.Lt]: { label: "less than", hint: "number < literal", needsValue: true },
  [IfConditionKind.Lte]: { label: "less or equal", hint: "number ≤ literal", needsValue: true },
  [IfConditionKind.Exists]: { label: "exists", hint: "field is not null/undefined", needsValue: false },
  [IfConditionKind.Empty]: { label: "empty", hint: "null, blank string, or empty list/object", needsValue: false },
  [IfConditionKind.Contains]: { label: "contains", hint: "string substring or list membership", needsValue: true },
  [IfConditionKind.In]: { label: "in list", hint: "value is one of the JSON literals", needsValue: true },
  [IfConditionKind.Truthy]: { label: "truthy", hint: "JS/Python truthiness of the field", needsValue: false },
}

export function ifConditionNeedsValue(kind: IfConditionKind): boolean {
  return IF_CONDITION_KIND_META[kind].needsValue
}

export function parseIfConditionKind(raw: string | undefined): IfConditionKind | undefined {
  if (!raw?.trim()) return undefined
  return KIND_ALIASES[raw.trim().toLowerCase()]
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

function asUnknownList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value]
}

export function parseIfCondition(kindRaw: string, path: string, value?: unknown): IfCondition {
  const kind = parseIfConditionKind(kindRaw) ?? IfConditionKind.Path
  const p = path.trim()
  if (kind === IfConditionKind.Gt || kind === IfConditionKind.Gte || kind === IfConditionKind.Lt || kind === IfConditionKind.Lte) {
    return { kind, path: p, value: asFiniteNumber(value) ?? 0 }
  }
  if (kind === IfConditionKind.In) return { kind, path: p, value: asUnknownList(value) }
  if (kind === IfConditionKind.Equals || kind === IfConditionKind.NotEquals || kind === IfConditionKind.Contains) {
    return { kind, path: p, value }
  }
  return { kind, path: p }
}

const pathField = z.string().max(512)

export const ifConditionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal(IfConditionKind.Path), path: pathField }),
  z.object({ kind: z.literal(IfConditionKind.Equals), path: pathField, value: z.unknown() }),
  z.object({ kind: z.literal(IfConditionKind.NotEquals), path: pathField, value: z.unknown() }),
  z.object({ kind: z.literal(IfConditionKind.Gt), path: pathField, value: z.number() }),
  z.object({ kind: z.literal(IfConditionKind.Gte), path: pathField, value: z.number() }),
  z.object({ kind: z.literal(IfConditionKind.Lt), path: pathField, value: z.number() }),
  z.object({ kind: z.literal(IfConditionKind.Lte), path: pathField, value: z.number() }),
  z.object({ kind: z.literal(IfConditionKind.Exists), path: pathField }),
  z.object({ kind: z.literal(IfConditionKind.Empty), path: pathField }),
  z.object({ kind: z.literal(IfConditionKind.Contains), path: pathField, value: z.unknown() }),
  z.object({ kind: z.literal(IfConditionKind.In), path: pathField, value: z.array(z.unknown()) }),
  z.object({ kind: z.literal(IfConditionKind.Truthy), path: pathField }),
])

export function defaultIfCondition(): IfCondition {
  return { kind: IfConditionKind.Path, path: "" }
}

export function jsonEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

function isEmptyValue(got: unknown): boolean {
  if (got == null) return true
  if (typeof got === "string") return got.length === 0
  if (Array.isArray(got)) return got.length === 0
  if (typeof got === "object") return Object.keys(got as object).length === 0
  return false
}

function isTruthyValue(got: unknown): boolean {
  if (typeof got === "boolean") return got
  if (typeof got === "number") return got !== 0 && !Number.isNaN(got)
  if (typeof got === "string") return got.length > 0
  if (Array.isArray(got)) return got.length > 0
  return got != null
}

function containsValue(got: unknown, needle: unknown): boolean {
  if (typeof got === "string") return got.includes(String(needle ?? ""))
  if (Array.isArray(got)) return got.some((item) => jsonEqual(item, needle))
  return false
}

export function formatIfCondition(cond?: IfCondition): string {
  const path = cond?.path.trim() ?? ""
  if (!path) return "set condition"
  switch (cond?.kind) {
    case IfConditionKind.Equals:
      return `${path} === ${JSON.stringify(cond.value)}`
    case IfConditionKind.NotEquals:
      return `${path} !== ${JSON.stringify(cond.value)}`
    case IfConditionKind.Gt:
      return `${path} > ${cond.value}`
    case IfConditionKind.Gte:
      return `${path} >= ${cond.value}`
    case IfConditionKind.Lt:
      return `${path} < ${cond.value}`
    case IfConditionKind.Lte:
      return `${path} <= ${cond.value}`
    case IfConditionKind.Exists:
      return `${path} != null`
    case IfConditionKind.Empty:
      return `empty(${path})`
    case IfConditionKind.Contains:
      return `${path} contains ${JSON.stringify(cond.value)}`
    case IfConditionKind.In:
      return `${path} in ${JSON.stringify(cond.value)}`
    case IfConditionKind.Truthy:
      return `truthy(${path})`
    default:
      return path
  }
}

export function evalIfCondition(cond: IfCondition | undefined, spine: unknown): boolean {
  const path = cond?.path.trim() ?? ""
  if (!path) throw new Error("if/else needs a condition path")
  const got = readDotPathValue(spine, path)
  switch (cond?.kind) {
    case IfConditionKind.Equals:
      return jsonEqual(got, cond.value)
    case IfConditionKind.NotEquals:
      return !jsonEqual(got, cond.value)
    case IfConditionKind.Gt:
    case IfConditionKind.Gte:
    case IfConditionKind.Lt:
    case IfConditionKind.Lte: {
      const n = asFiniteNumber(got)
      if (n === undefined) throw new Error(`if/else path "${path}" must be a number, got ${typeof got}`)
      if (cond.kind === IfConditionKind.Gt) return n > cond.value
      if (cond.kind === IfConditionKind.Gte) return n >= cond.value
      if (cond.kind === IfConditionKind.Lt) return n < cond.value
      return n <= cond.value
    }
    case IfConditionKind.Exists:
      return got !== undefined && got !== null
    case IfConditionKind.Empty:
      return isEmptyValue(got)
    case IfConditionKind.Contains:
      return containsValue(got, cond.value)
    case IfConditionKind.In:
      return cond.value.some((item) => jsonEqual(got, item))
    case IfConditionKind.Truthy:
      return isTruthyValue(got)
    default:
      if (typeof got !== "boolean") {
        throw new Error(`if/else path "${path}" must be bool, got ${got === null ? "null" : typeof got}`)
      }
      return got
  }
}

function unwrapOptional(t: TypeExpr): { optional: boolean; inner: TypeExpr } {
  if (t.kind === TypeExprKind.Optional) {
    const inner = unwrapOptional(t.inner)
    return { optional: true, inner: inner.inner }
  }
  return { optional: false, inner: t }
}

function isNumberType(t: TypeExpr): boolean {
  return t.kind === TypeExprKind.Prim && (t.name === PrimName.Int || t.name === PrimName.Float)
}

function isTextType(t: TypeExpr): boolean {
  return t.kind === TypeExprKind.Prim && (t.name === PrimName.Text || t.name === PrimName.Markdown || t.name === PrimName.Latex)
}

function isBoolType(t: TypeExpr): boolean {
  return t.kind === TypeExprKind.Prim && t.name === PrimName.Bool
}

function jsonFitsType(value: unknown, t: TypeExpr): boolean {
  const { optional, inner } = unwrapOptional(t)
  if (value === null || value === undefined) return optional
  if (inner.kind === TypeExprKind.Unknown || inner.kind === TypeExprKind.Unset) return true
  if (inner.kind === TypeExprKind.Prim && inner.name === PrimName.Json) return true
  if (inner.kind === TypeExprKind.Union) return inner.variants.some((v) => jsonFitsType(value, v))
  if (isBoolType(inner)) return typeof value === "boolean"
  if (inner.kind === TypeExprKind.Prim && inner.name === PrimName.Int) {
    return typeof value === "number" && Number.isInteger(value)
  }
  if (inner.kind === TypeExprKind.Prim && inner.name === PrimName.Float) return typeof value === "number" && Number.isFinite(value)
  if (isTextType(inner) || inner.kind === TypeExprKind.Named) return typeof value === "string"
  if (inner.kind === TypeExprKind.List) return Array.isArray(value)
  if (inner.kind === TypeExprKind.Set) return Array.isArray(value)
  if (inner.kind === TypeExprKind.Map || inner.kind === TypeExprKind.Ref) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
  }
  return true
}

export function ifConditionTypeError(cond: IfCondition, at: TypeExpr): string | undefined {
  const { inner } = unwrapOptional(at)
  const path = cond.path.trim()
  switch (cond.kind) {
    case IfConditionKind.Path:
      if (!isBoolType(inner)) return `condition path "${path}" must be bool`
      return undefined
    case IfConditionKind.Gt:
    case IfConditionKind.Gte:
    case IfConditionKind.Lt:
    case IfConditionKind.Lte:
      if (!isNumberType(inner)) return `condition path "${path}" must be int or float for ${cond.kind}`
      return undefined
    case IfConditionKind.Empty:
      if (
        inner.kind !== TypeExprKind.List &&
        inner.kind !== TypeExprKind.Set &&
        inner.kind !== TypeExprKind.Map &&
        !isTextType(inner)
      ) {
        return `condition path "${path}" must be text, list, set, or map for empty`
      }
      return undefined
    case IfConditionKind.Contains:
      if (!isTextType(inner) && inner.kind !== TypeExprKind.List) {
        return `condition path "${path}" must be text or list for contains`
      }
      return undefined
    case IfConditionKind.Equals:
    case IfConditionKind.NotEquals:
      if (!jsonFitsType(cond.value, at)) return `equals value does not match type of "${path}"`
      return undefined
    case IfConditionKind.In:
      if (!cond.value.length) return `in-list needs at least one value`
      if (cond.value.some((item) => !jsonFitsType(item, at))) return `in-list value does not match type of "${path}"`
      return undefined
    case IfConditionKind.Exists:
    case IfConditionKind.Truthy:
      return undefined
  }
}

export function suggestedIfConditionKinds(at: TypeExpr): IfConditionKind[] {
  const { optional, inner } = unwrapOptional(at)
  const kinds: IfConditionKind[] = [IfConditionKind.Equals, IfConditionKind.NotEquals, IfConditionKind.In, IfConditionKind.Truthy]
  if (optional) kinds.unshift(IfConditionKind.Exists)
  if (isBoolType(inner)) kinds.unshift(IfConditionKind.Path)
  if (isNumberType(inner)) kinds.push(IfConditionKind.Gt, IfConditionKind.Gte, IfConditionKind.Lt, IfConditionKind.Lte)
  if (isTextType(inner) || inner.kind === TypeExprKind.List) kinds.push(IfConditionKind.Contains, IfConditionKind.Empty)
  if (inner.kind === TypeExprKind.Set || inner.kind === TypeExprKind.Map) kinds.push(IfConditionKind.Empty)
  return IF_CONDITION_KINDS.filter((k) => kinds.includes(k))
}
