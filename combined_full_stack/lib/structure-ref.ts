import { sanitizeFieldName } from "@/lib/csv-parse"
import type { ModelField, StructureModel, StructureModelId } from "@/lib/types"

function toPascalCase(raw: string): string {
  const parts = raw.replace(/[^\w]+/g, "_").split("_").filter(Boolean)
  if (!parts.length) return "Row"
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("")
}

export function referencedModelIds(models: StructureModel[]): Set<StructureModelId> {
  const ids = new Set<StructureModelId>()
  for (const m of models) {
    for (const f of m.fields) {
      if (f.ref) ids.add(f.ref)
    }
  }
  return ids
}

export function resolveReferencedModel(
  models: StructureModel[],
  ref: StructureModelId | undefined,
): StructureModel | undefined {
  if (!ref) return undefined
  return models.find((m) => m.id === ref)
}

// AI : human label when Select can't match ref id — never show raw content hashes in the UI.
export function modelRefLabel(
  models: StructureModel[],
  ref: StructureModelId | undefined,
  fieldNames: string[],
): string {
  const hit = resolveReferencedModel(models, ref)
  if (hit) return hit.name
  if (!ref) return "pick model"
  if (fieldNames.length === 1) {
    return `${toPascalCase(sanitizeFieldName(fieldNames[0]!))}Rule`
  }
  return fieldNames.map((n) => toPascalCase(sanitizeFieldName(n))).join(" · ")
}

function fieldNamesForRef(
  fields: Pick<ModelField, "ref" | "name">[],
  refId: StructureModelId,
): string[] {
  return [...new Set(fields.filter((f) => f.ref === refId).map((f) => f.name))]
}

// AI : pool every selectable model — include missing companions for all refs on this structure.
export function modelsForRefPicker(
  models: StructureModel[],
  selectedId: string,
  fields: Pick<ModelField, "ref" | "name">[],
): StructureModel[] {
  const pool = models.filter((m) => m.id !== selectedId)
  const byId = new Map(pool.map((m) => [m.id, m]))
  const missingRefIds = [
    ...new Set(
      fields.map((f) => f.ref).filter((id): id is StructureModelId => !!id && !byId.has(id)),
    ),
  ]
  const stubs = missingRefIds.map((refId) => ({
    id: refId,
    name: modelRefLabel(models, refId, fieldNamesForRef(fields, refId)),
    description: "Missing companion — pick another model or re-sync the source document.",
    fields: [] as ModelField[],
    auto: true as const,
  }))
  return [...pool, ...stubs].sort((a, b) => a.name.localeCompare(b.name))
}

export function refPickerLabel(fieldType: ModelField["type"]): string {
  return fieldType === "list[model]" ? "↳ references model (list)" : "↳ references model"
}

const MAPPING_RULE_NAME = "MappingRule"

const MAPPING_RULE_FIELDS: ModelField[] = [
  { id: "f_source", name: "source", type: "text", optional: false, description: "" },
  { id: "f_transform", name: "transform", type: "text", optional: true, description: "" },
  { id: "f_default", name: "default", type: "text", optional: true, description: "" },
]

// AI : recreate missing companions so model refs resolve to named structures again.
export function repairOrphanModelRefs(
  models: StructureModel[],
  idGen: () => StructureModelId,
): StructureModel[] {
  const byId = new Map(models.map((m) => [m.id, m]))
  const orphans = new Set<StructureModelId>()
  for (const m of models) {
    for (const f of m.fields) {
      if (f.ref && !byId.has(f.ref)) orphans.add(f.ref)
    }
  }
  if (!orphans.size) return models

  let mappingRule = models.find((m) => m.name === MAPPING_RULE_NAME)
  if (!mappingRule) {
    mappingRule = {
      id: idGen(),
      name: MAPPING_RULE_NAME,
      description: "Field mapping rule (source / transform / default).",
      auto: true,
      fields: MAPPING_RULE_FIELDS,
    }
  }

  const remap = new Map<StructureModelId, StructureModelId>()
  for (const orphanId of orphans) {
    remap.set(orphanId, mappingRule.id)
  }

  const next = models.map((m) => ({
    ...m,
    fields: m.fields.map((f) =>
      f.ref && remap.has(f.ref) ? { ...f, ref: remap.get(f.ref)! } : f,
    ),
  }))

  if (!byId.has(mappingRule.id)) next.push(mappingRule)
  return next
}
