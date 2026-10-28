// AI : JSON / tabular docs → virtual tables using the same child-table rules as schema.sql.
import { tryParseJson } from "@/lib/json-utils"
import { findMatchingStructures } from "@/lib/structure-match"
import { pkFieldOf, sqlIdent, sqlTableName } from "@/lib/sql-id-types"
import { fieldToTypeExpr, TypeExprKind } from "@/lib/server/type_expr"
import { tabularRowSetsFromContent } from "@/lib/tabular-row-sets"
import type { DocId, InputType, ModelField, StructureModel, StructureModelId, TypeAlias } from "@/lib/types"

export type CatalogTableId = string & { __brand: "CatalogTableId" }

export type RowPath = {
  docName?: string
  docId?: DocId
  jsonPath: string
}

export type CatalogRow = {
  table: CatalogTableId
  modelId?: StructureModelId
  pk?: { field: string; value: string }
  values: Record<string, unknown>
  source: RowPath
}

export type CatalogTable = {
  name: CatalogTableId
  modelId?: StructureModelId
  pkField?: string
  rows: CatalogRow[]
  boundDoc?: string
}

export type Catalog = {
  tables: CatalogTable[]
}

export type CatalogDocInput = {
  name: string
  type: InputType
  content: string
  id?: DocId
}

function asTableId(name: string): CatalogTableId {
  return name as CatalogTableId
}

function childTableName(parent: StructureModel, field: ModelField): CatalogTableId {
  return asTableId(`${sqlTableName(parent.name)}_${sqlIdent(field.name)}`)
}

function scalarId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return undefined
}

function nestedListModelId(field: ModelField): StructureModelId | undefined {
  const expr = fieldToTypeExpr(field)
  if (expr.kind === TypeExprKind.List && expr.item.kind === TypeExprKind.Ref) return expr.item.modelId
  if (
    expr.kind === TypeExprKind.Optional &&
    expr.inner.kind === TypeExprKind.List &&
    expr.inner.item.kind === TypeExprKind.Ref
  ) {
    return expr.inner.item.modelId
  }
  return undefined
}

function nestedModelId(field: ModelField): StructureModelId | undefined {
  const expr = fieldToTypeExpr(field)
  if (expr.kind === TypeExprKind.Ref) return expr.modelId
  if (expr.kind === TypeExprKind.Optional && expr.inner.kind === TypeExprKind.Ref) return expr.inner.modelId
  return undefined
}

function tableOf(catalog: Catalog, name: CatalogTableId, modelId?: StructureModelId, pkField?: string): CatalogTable {
  let table = catalog.tables.find((t) => t.name === name)
  if (!table) {
    table = { name, modelId, pkField, rows: [] }
    catalog.tables.push(table)
  }
  return table
}

function walkObject(
  obj: Record<string, unknown>,
  model: StructureModel,
  models: StructureModel[],
  source: RowPath,
  catalog: Catalog,
  parentFk?: { field: string; value: string },
  tableName?: CatalogTableId,
): void {
  const pk = pkFieldOf(model)
  const pkValue = pk ? scalarId(obj[pk.name]) : undefined
  const table = tableOf(catalog, tableName ?? asTableId(sqlTableName(model.name)), model.id, pk?.name)
  const values: Record<string, unknown> = { ...obj }
  if (parentFk) values[parentFk.field] = parentFk.value
  table.rows.push({
    table: table.name,
    modelId: model.id,
    pk: pk && pkValue ? { field: pk.name, value: pkValue } : undefined,
    values,
    source,
  })

  for (const field of model.fields) {
    const childId = nestedListModelId(field)
    if (childId) {
      const childModel = models.find((m) => m.id === childId)
      const items = obj[field.name]
      if (!childModel || !Array.isArray(items)) continue
      const childTable = pk ? childTableName(model, field) : undefined
      const parentCol = pk ? `${sqlTableName(model.name)}_id` : undefined
      items.forEach((item, i) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return
        walkObject(
          item as Record<string, unknown>,
          childModel,
          models,
          { ...source, jsonPath: `${source.jsonPath}.${field.name}[${i}]` },
          catalog,
          pk && pkValue && parentCol ? { field: parentCol, value: pkValue } : undefined,
          childTable,
        )
      })
      continue
    }
    const nestedId = nestedModelId(field)
    if (!nestedId) continue
    const nestedModel = models.find((m) => m.id === nestedId)
    const nested = obj[field.name]
    if (!nestedModel || !nested || typeof nested !== "object" || Array.isArray(nested)) continue
    walkObject(nested as Record<string, unknown>, nestedModel, models, {
      ...source,
      jsonPath: `${source.jsonPath}.${field.name}`,
    }, catalog)
  }
}

function ingestValue(
  value: unknown,
  model: StructureModel,
  models: StructureModel[],
  source: RowPath,
  catalog: Catalog,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return
      walkObject(item as Record<string, unknown>, model, models, {
        ...source,
        jsonPath: `${source.jsonPath}[${i}]`,
      }, catalog)
    })
    return
  }
  if (value && typeof value === "object") {
    walkObject(value as Record<string, unknown>, model, models, source, catalog)
  }
}

function pickBindModel(
  value: unknown,
  models: StructureModel[],
  typeAliases: TypeAlias[],
  preferredId?: StructureModelId,
): StructureModel | undefined {
  if (preferredId) {
    const preferred = models.find((m) => m.id === preferredId)
    if (preferred) return preferred
  }
  const matches = findMatchingStructures(value, models, typeAliases)
  const list = matches.find((m) => m.matchKind === "list")
  const hit = list ?? matches[0]
  return hit ? models.find((m) => m.id === hit.modelId) : undefined
}

export function catalogFromDocs(
  docs: CatalogDocInput[],
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): Catalog {
  const catalog: Catalog = { tables: [] }
  for (const doc of docs) {
    const parsed = tryParseJson(doc.content.trim())
    if (!parsed.ok) continue
    const preferred = models.find((m) => m.sourceDocId && doc.id && m.sourceDocId === doc.id)?.id
    const bind = pickBindModel(parsed.value, models, typeAliases, preferred)
    const source: RowPath = { docName: doc.name, docId: doc.id, jsonPath: "$" }
    if (bind) {
      ingestValue(parsed.value, bind, models, source, catalog)
      const table = catalog.tables.find((t) => t.modelId === bind.id)
      if (table && !table.boundDoc) table.boundDoc = doc.name
      continue
    }
    const rowSets = tabularRowSetsFromContent(doc.content, doc.name, doc.type)
    if (!rowSets?.length) continue
    for (const set of rowSets) {
      const setBind = pickBindModel(set.rows, models, typeAliases, preferred)
      if (!setBind) continue
      ingestValue(set.rows, setBind, models, { ...source, jsonPath: `$.${set.name}` }, catalog)
    }
  }
  return catalog
}
