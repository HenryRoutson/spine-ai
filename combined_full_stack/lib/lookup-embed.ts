// AI : lookup-embed for prompt/context views — spine stays normalized FKs.
// AI : grep "TODO (type-join)" / "DONE (type-join)". Do not flatten job_example_library.json.

import { fieldToTypeExpr, typeExprRefModelId } from "@/lib/server/type_expr"
import type { StructureModel, StructureModelId } from "@/lib/types"

export type LookupEmbedHow = "spread" | "embed"

export type LookupEmbedSpec = {
  leftPath: string
  leftKey: string
  rightKey?: string
  embedAs?: string
  how: LookupEmbedHow
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
}

function scalarId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return undefined
}

export function indexRowsByKey(rows: unknown[], key: string): Map<string, Record<string, unknown>> {
  const index = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    if (!isPlainObject(row)) continue
    const id = scalarId(row[key])
    if (id) index.set(id, row)
  }
  return index
}

function spreadLookup(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...left }
  for (const [k, v] of Object.entries(right)) {
    if (k in out) continue
    out[k] = v
  }
  return out
}

function applyLeaf(
  value: unknown,
  spec: LookupEmbedSpec,
  index: Map<string, Record<string, unknown>>,
): unknown {
  if (!isPlainObject(value)) return value
  const id = scalarId(value[spec.leftKey])
  const right = id ? index.get(id) : undefined
  if (!right) return value
  if (spec.how === "embed") {
    const nest = spec.embedAs?.trim() || "lookup"
    return { ...value, [nest]: right }
  }
  return spreadLookup(value, right)
}

function mapAtPath(
  value: unknown,
  parts: string[],
  spec: LookupEmbedSpec,
  index: Map<string, Record<string, unknown>>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => mapAtPath(item, parts, spec, index))
  }
  if (parts.length === 0) return applyLeaf(value, spec, index)
  if (!isPlainObject(value)) return value
  const [head, ...rest] = parts
  if (!head || !(head in value)) return value
  return { ...value, [head]: mapAtPath(value[head], rest, spec, index) }
}

export function applyLookupEmbed(
  value: unknown,
  spec: LookupEmbedSpec,
  index: Map<string, Record<string, unknown>>,
): unknown {
  const parts = spec.leftPath.split(".").map((p) => p.trim()).filter(Boolean)
  return mapAtPath(value, parts, spec, index)
}

export function applyLookupEmbeds(value: unknown, specs: LookupEmbedSpec[], rightRows: unknown[]): unknown {
  if (!specs.length) return value
  return specs.reduce((acc, spec) => {
    const key = spec.rightKey?.trim() || "id"
    return applyLookupEmbed(acc, spec, indexRowsByKey(rightRows, key))
  }, value)
}

function collectFkEmbedSpecs(
  model: StructureModel,
  models: StructureModel[],
  lookupModelId: StructureModelId,
  prefix: string,
  ancestors: ReadonlySet<StructureModelId>,
  acc: LookupEmbedSpec[],
): void {
  if (ancestors.has(model.id)) return
  const next = new Set(ancestors)
  next.add(model.id)
  for (const field of model.fields) {
    const rel = field.relation
    if (rel?.kind === "fk" && rel.to.modelId === lookupModelId) {
      acc.push({
        leftPath: prefix,
        leftKey: field.name,
        rightKey: rel.to.field,
        how: "spread",
      })
    }
    const childId = typeExprRefModelId(fieldToTypeExpr(field))
    if (!childId || childId === lookupModelId) continue
    const child = models.find((m) => m.id === childId)
    if (!child) continue
    const path = prefix ? `${prefix}.${field.name}` : field.name
    collectFkEmbedSpecs(child, models, lookupModelId, path, next, acc)
  }
}

// AI : specs for FKs in the context model that point at the candidate catalog (pass 2 billed_items).
export function autoFkEmbedSpecs(
  models: StructureModel[],
  contextModelId: StructureModelId | undefined,
  lookupModelId: StructureModelId | undefined,
): LookupEmbedSpec[] {
  if (!contextModelId || !lookupModelId || contextModelId === lookupModelId) return []
  const contextModel = models.find((m) => m.id === contextModelId)
  if (!contextModel) return []
  const acc: LookupEmbedSpec[] = []
  collectFkEmbedSpecs(contextModel, models, lookupModelId, "", new Set(), acc)
  return acc
}
