import { isLockedStructureModel } from "@/lib/server/builtin_models"
import { fieldToTypeExpr } from "@/lib/server/type_expr"
import { stableJson } from "@/lib/run-fingerprint"
import type { StructureModel } from "@/lib/types"

export type ProposalItemChangeKind = "added" | "removed" | "modified"

export type StructureModelDiffEntry = {
  kind: ProposalItemChangeKind
  name: string
  locked: boolean
  addedFields: string[]
  removedFields: string[]
  before: StructureModel | null
  after: StructureModel | null
}

function fieldNames(m: StructureModel): string[] {
  return m.fields.map((f) => f.name).filter((n) => n.trim())
}

function structureModelReviewKey(m: StructureModel): string {
  return stableJson({
    name: m.name,
    description: m.description ?? "",
    params: m.params ?? [],
    fields: m.fields.map((f) => ({
      name: f.name,
      type: f.type,
      ref: f.ref ?? null,
      optional: !!f.optional,
      description: f.description ?? "",
      examples: f.examples ?? [],
      negativeExamples: f.negativeExamples ?? [],
      minItems: f.minItems ?? null,
      maxItems: f.maxItems ?? null,
      minLength: f.minLength ?? null,
      maxLength: f.maxLength ?? null,
      typeExpr: fieldToTypeExpr(f),
    })),
  })
}

export function structureModelsContentEqual(a: StructureModel, b: StructureModel): boolean {
  return structureModelReviewKey(a) === structureModelReviewKey(b)
}

function matchExisting(
  model: StructureModel,
  byId: Map<string, StructureModel>,
  byName: Map<string, StructureModel>,
): StructureModel | undefined {
  return byId.get(model.id) ?? byName.get(model.name.toLowerCase())
}

// AI : per-struct delta for Vibe review — LLM returns the full models array even for a 1-field tweak.
export function diffStructureModels(
  before: StructureModel[],
  after: StructureModel[],
): StructureModelDiffEntry[] {
  const beforeById = new Map(before.map((m) => [m.id, m]))
  const beforeByName = new Map(before.map((m) => [m.name.toLowerCase(), m]))
  const matchedBefore = new Set<string>()
  const out: StructureModelDiffEntry[] = []

  for (const next of after) {
    const prev = matchExisting(next, beforeById, beforeByName)
    if (!prev) {
      out.push({
        kind: "added",
        name: next.name,
        locked: isLockedStructureModel(next),
        addedFields: fieldNames(next),
        removedFields: [],
        before: null,
        after: next,
      })
      continue
    }
    matchedBefore.add(prev.id)
    if (structureModelsContentEqual(prev, next)) continue
    const prevNames = new Set(fieldNames(prev))
    const nextNames = new Set(fieldNames(next))
    out.push({
      kind: "modified",
      name: next.name,
      locked: isLockedStructureModel(next) || isLockedStructureModel(prev),
      addedFields: fieldNames(next).filter((n) => !prevNames.has(n)),
      removedFields: fieldNames(prev).filter((n) => !nextNames.has(n)),
      before: prev,
      after: next,
    })
  }

  for (const prev of before) {
    if (matchedBefore.has(prev.id)) continue
    out.push({
      kind: "removed",
      name: prev.name,
      locked: isLockedStructureModel(prev),
      addedFields: [],
      removedFields: fieldNames(prev),
      before: prev,
      after: null,
    })
  }

  return out
}
