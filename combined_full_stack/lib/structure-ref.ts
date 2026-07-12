import { sanitizeFieldName } from "@/lib/csv-parse"
import { isSharedStructureModel } from "@/lib/server/builtin_models"
import { collectTypeExprRefModelIds, fieldToTypeExpr } from "@/lib/server/type_expr"
import { FieldType } from "@/lib/types"
import type { ModelField, StructureModel, StructureModelId } from "@/lib/types"

function toPascalCase(raw: string): string {
  const parts = raw.replace(/[^\w]+/g, "_").split("_").filter(Boolean)
  if (!parts.length) return "Row"
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("")
}

function fieldRefModelIds(f: ModelField): StructureModelId[] {
  const ids: StructureModelId[] = []
  if (f.ref) ids.push(f.ref)
  ids.push(...collectTypeExprRefModelIds(fieldToTypeExpr(f)))
  return ids
}

export function referencedModelIds(models: StructureModel[]): Set<StructureModelId> {
  const ids = new Set<StructureModelId>()
  for (const m of models) {
    for (const f of m.fields) {
      for (const refId of fieldRefModelIds(f)) ids.add(refId)
    }
  }
  return ids
}

// AI : top-level structs — not referenced as a field type on any other model.
export function rootModelIds(models: StructureModel[]): Set<StructureModelId> {
  const referenced = referencedModelIds(models)
  return new Set(
    models.filter((m) => !referenced.has(m.id)).map((m) => m.id),
  )
}

function isModelRefTarget(m: StructureModel): boolean {
  return !isSharedStructureModel(m)
}

export type RefPickerGroups = {
  roots: StructureModel[]
  nested: StructureModel[]
  self?: StructureModel
  missing: StructureModel[]
}

function sortByName(models: StructureModel[]): StructureModel[] {
  return [...models].sort((a, b) => a.name.localeCompare(b.name))
}

// AI : group selectable refs — roots first so sub-types can be defined in separate structs.
export function groupModelsForRefPicker(
  models: StructureModel[],
  selectedId: string,
  fields: Pick<ModelField, "ref" | "name">[],
): RefPickerGroups {
  const selectable = models.filter(isModelRefTarget)
  const byId = new Map(selectable.map((m) => [m.id, m]))
  const roots = rootModelIds(selectable)
  const self = selectable.find((m) => m.id === selectedId)

  const missingRefIds = [
    ...new Set(
      fields.map((f) => f.ref).filter((id): id is StructureModelId => !!id && !byId.has(id)),
    ),
  ]
  const missing = missingRefIds.map((refId) => ({
    id: refId,
    name: modelRefLabel(models, refId, fieldNamesForRef(fields, refId)),
    description: "Missing companion — pick another model or re-sync the source document.",
    fields: [] as ModelField[],
    auto: true as const,
  }))

  const rootPool = sortByName(
    selectable.filter((m) => roots.has(m.id) && m.id !== selectedId),
  )
  const nestedPool = sortByName(
    selectable.filter((m) => !roots.has(m.id) && m.id !== selectedId),
  )

  return {
    roots: rootPool,
    nested: nestedPool,
    self,
    missing: sortByName(missing),
  }
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

// AI : pool every selectable model — roots, nested companions, self (recursive), and missing refs.
export function modelsForRefPicker(
  models: StructureModel[],
  selectedId: string,
  fields: Pick<ModelField, "ref" | "name">[],
): StructureModel[] {
  const { roots, nested, self, missing } = groupModelsForRefPicker(models, selectedId, fields)
  const seen = new Set<StructureModelId>()
  const out: StructureModel[] = []
  for (const m of [...roots, ...nested, ...(self ? [self] : []), ...missing]) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    out.push(m)
  }
  return out
}

export function pickDefaultModelRef(
  models: StructureModel[],
  selectedId: string,
): StructureModelId | undefined {
  const { roots, nested } = groupModelsForRefPicker(models, selectedId, [])
  return roots[0]?.id ?? nested[0]?.id
}

export function defaultModelTypeExprString(
  models: StructureModel[],
  selectedId: string,
  asList: boolean,
): string {
  const ref = pickDefaultModelRef(models, selectedId)
  const name = ref ? models.find((m) => m.id === ref)?.name : undefined
  return asList ? `list[${name ?? "Model"}]` : (name ?? "Model")
}

export function refPickerLabel(fieldType: ModelField["type"]): string {
  return fieldType === FieldType.ListModel ? "↳ references model (list)" : "↳ references model"
}

const MAPPING_RULE_NAME = "MappingRule"

const MAPPING_RULE_FIELDS: ModelField[] = [
  { id: "f_source", name: "source", type: FieldType.Text, optional: false, description: "" },
  { id: "f_transform", name: "transform", type: FieldType.Text, optional: true, description: "" },
  { id: "f_default", name: "default", type: FieldType.Text, optional: true, description: "" },
]

// AI : explicit repair only (doc-structure sync) — migrateProjectModules must NOT call this;
// AI : dangling refs stay visible via computeStructureIssues / Structure tab.
export function repairOrphanModelRefs(
  models: StructureModel[],
  idGen: () => StructureModelId,
): StructureModel[] {
  const byId = new Map(models.map((m) => [m.id, m]))
  const orphans = new Set<StructureModelId>()
  for (const m of models) {
    for (const f of m.fields) {
      for (const refId of fieldRefModelIds(f)) {
        if (!byId.has(refId)) orphans.add(refId)
      }
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
