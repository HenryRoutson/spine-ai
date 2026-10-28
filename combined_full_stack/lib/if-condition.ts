// AI : if/else is control flow — branch on a bool spine field. Comparisons belong in custom-code / Python.
import { z } from "zod"
import { IfConditionKind, type IfCondition } from "@/lib/types"
import { PrimName, TypeExprKind, type TypeExpr } from "@/lib/server/type_expr"
import { readDotPathValue } from "@/lib/type-expr-polymorph"

export const IF_CONDITION_KINDS = [IfConditionKind.Path] as const

export type IfConditionKindId = (typeof IF_CONDITION_KINDS)[number]

export function parseIfConditionKind(_raw: string | undefined): IfConditionKind {
  return IfConditionKind.Path
}

export function parseIfCondition(_kindRaw: string, path: string, _value?: unknown): IfCondition {
  return { kind: IfConditionKind.Path, path: path.trim() }
}

const pathField = z.string().max(512)

export const ifConditionSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw
  const path = String((raw as { path?: unknown }).path ?? "")
  return { kind: IfConditionKind.Path, path }
}, z.object({ kind: z.literal(IfConditionKind.Path), path: pathField }))

export function defaultIfCondition(): IfCondition {
  return { kind: IfConditionKind.Path, path: "" }
}

export function formatIfCondition(cond?: IfCondition): string {
  const path = cond?.path.trim() ?? ""
  return path || "set bool path"
}

export function evalIfCondition(cond: IfCondition | undefined, spine: unknown): boolean {
  const path = cond?.path.trim() ?? ""
  if (!path) throw new Error("if/else needs a bool spine path")
  const got = readDotPathValue(spine, path)
  if (typeof got !== "boolean") {
    throw new Error(`if/else path "${path}" must be bool, got ${got === null ? "null" : typeof got}`)
  }
  return got
}

function unwrapOptional(t: TypeExpr): TypeExpr {
  if (t.kind === TypeExprKind.Optional) return unwrapOptional(t.inner)
  return t
}

export function ifConditionTypeError(cond: IfCondition, at: TypeExpr): string | undefined {
  const inner = unwrapOptional(at)
  const path = cond.path.trim()
  if (inner.kind === TypeExprKind.Prim && inner.name === PrimName.Bool) return undefined
  return `condition path "${path}" must be bool — compute comparisons in custom-code`
}
