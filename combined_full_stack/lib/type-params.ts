// AI : parse/format/instantiate StructureModel.params and TypeAlias.params — one helper for GUI/CLI/MCP/codegen.
import { TypeExprKind, UNSET_TYPE_EXPR, type TypeExpr } from "@/lib/server/type_expr"
import type { StructureModel, StructureModelId, TypeAlias } from "@/lib/types"

export function parseTypeParams(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(",")) {
    const p = part.trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(p) || seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

export function normalizeTypeParams(raw?: readonly string[] | string | null): string[] | undefined {
  const text = typeof raw === "string" ? raw : (raw ?? []).join(",")
  const params = parseTypeParams(text)
  return params.length ? params : undefined
}

export function formatTypeParams(params?: readonly string[]): string {
  return params?.length ? `[${params.join(", ")}]` : ""
}

export function formatParametricName(name: string, params?: readonly string[]): string {
  return `${name}${formatTypeParams(params)}`
}

export function formatParamsTs(params?: readonly string[]): string {
  return params?.length ? `<${params.join(", ")}>` : ""
}

export function formatParamsGo(params?: readonly string[]): string {
  return params?.length ? `[${params.map((p) => `${p} any`).join(", ")}]` : ""
}

function unsetArgs(n: number): TypeExpr[] {
  return Array.from({ length: n }, () => UNSET_TYPE_EXPR)
}

export function instantiateModelType(model: Pick<StructureModel, "id" | "params">): TypeExpr {
  const n = model.params?.length ?? 0
  return n
    ? { kind: TypeExprKind.Ref, modelId: model.id as StructureModelId, args: unsetArgs(n) }
    : { kind: TypeExprKind.Ref, modelId: model.id as StructureModelId }
}

export function instantiateAliasType(alias: Pick<TypeAlias, "name" | "params">): TypeExpr {
  const n = alias.params?.length ?? 0
  return n
    ? { kind: TypeExprKind.Generic, name: alias.name, args: unsetArgs(n) }
    : { kind: TypeExprKind.Named, name: alias.name }
}

export function typeExprNeedsArgEditor(expr: TypeExpr | undefined): boolean {
  if (!expr) return false
  if (expr.kind === TypeExprKind.Ref) return (expr.args?.length ?? 0) > 0
  if (expr.kind === TypeExprKind.Generic) return true
  if (expr.kind === TypeExprKind.List || expr.kind === TypeExprKind.Set) return typeExprNeedsArgEditor(expr.item)
  if (expr.kind === TypeExprKind.Optional) return typeExprNeedsArgEditor(expr.inner)
  return false
}
