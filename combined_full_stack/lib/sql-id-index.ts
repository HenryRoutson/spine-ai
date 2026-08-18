// AI : one list per branded id type — missing pk, duplicate pk, unused pk.
import { catalogFromDocs, type Catalog, type CatalogDocInput, type CatalogRow, type RowPath } from "@/lib/sql-catalog"
import { collectSqlIdTypes, pkFieldOf, sqlIdent, sqlTableName, type sql_id_type_name } from "@/lib/sql-id-types"
import type { StructureModel, TypeAlias } from "@/lib/types"

export type IdOccurrenceKind = "pk" | "fk"

export type IdOccurrence = {
  value: string
  kind: IdOccurrenceKind
  table: string
  field: string
  rowPk?: string
  source: RowPath
}

export type IdIndexBucket = {
  idType: sql_id_type_name
  targetModel: string
  targetField: string
  pkCount: number
  fkCount: number
  missing: number
  unused: number
  duplicate: number
  values: Map<string, IdOccurrence[]>
}

export type IdIntegrityIssue =
  | { kind: "missing-pk"; idType: sql_id_type_name; value: string; fks: IdOccurrence[] }
  | { kind: "unused-pk"; idType: sql_id_type_name; value: string; pk: IdOccurrence }
  | { kind: "duplicate-pk"; idType: sql_id_type_name; value: string; pks: IdOccurrence[] }

export type IdIndex = {
  buckets: IdIndexBucket[]
  issues: IdIntegrityIssue[]
}

function scalarId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return undefined
}

function pushOcc(bucket: IdIndexBucket, occ: IdOccurrence): void {
  const list = bucket.values.get(occ.value) ?? []
  list.push(occ)
  bucket.values.set(occ.value, list)
}

function parentFkField(parentTable: string): string {
  return `${parentTable}_id`
}

export function buildIdIndex(catalog: Catalog, models: StructureModel[]): IdIndex {
  const types = collectSqlIdTypes(models)
  const buckets: IdIndexBucket[] = types.map((t) => ({
    idType: t.name,
    targetModel: t.pkModelName,
    targetField: t.pkField,
    pkCount: 0,
    fkCount: 0,
    missing: 0,
    unused: 0,
    duplicate: 0,
    values: new Map(),
  }))
  const byType = new Map(buckets.map((b) => [b.idType, b]))
  const byPkModel = new Map(types.map((t) => [t.pkModelId, t]))

  for (const table of catalog.tables) {
    const model = table.modelId ? models.find((m) => m.id === table.modelId) : undefined
    for (const row of table.rows) {
      collectRowIds(row, model, models, byType, byPkModel)
    }
  }

  const issues: IdIntegrityIssue[] = []
  for (const bucket of buckets) {
    const type = types.find((t) => t.name === bucket.idType)
    const hasFkColumns = (type?.fkFields.length ?? 0) > 0
    for (const [value, occs] of bucket.values) {
      const pks = occs.filter((o) => o.kind === "pk")
      const fks = occs.filter((o) => o.kind === "fk")
      bucket.pkCount += pks.length
      bucket.fkCount += fks.length
      if (pks.length > 1) {
        bucket.duplicate += 1
        issues.push({ kind: "duplicate-pk", idType: bucket.idType, value, pks })
      }
      if (fks.length && pks.length === 0) {
        bucket.missing += 1
        issues.push({ kind: "missing-pk", idType: bucket.idType, value, fks })
      }
      if (hasFkColumns && pks.length === 1 && fks.length === 0) {
        bucket.unused += 1
        issues.push({ kind: "unused-pk", idType: bucket.idType, value, pk: pks[0]! })
      }
    }
  }
  return { buckets, issues }
}

function collectRowIds(
  row: CatalogRow,
  model: StructureModel | undefined,
  models: StructureModel[],
  byType: Map<sql_id_type_name, IdIndexBucket>,
  byPkModel: Map<string, { name: sql_id_type_name }>,
): void {
  if (model) {
    const pk = pkFieldOf(model)
    if (pk) {
      const type = byPkModel.get(model.id)
      const value = scalarId(row.values[pk.name])
      if (type && value) {
        const bucket = byType.get(type.name)
        bucket &&
          pushOcc(bucket, {
            value,
            kind: "pk",
            table: row.table,
            field: pk.name,
            rowPk: value,
            source: row.source,
          })
      }
    }
    for (const field of model.fields) {
      const rel = field.relation
      if (rel?.kind !== "fk") continue
      const target = byPkModel.get(rel.to.modelId)
      const value = scalarId(row.values[field.name])
      if (!target || value === undefined) continue
      const bucket = byType.get(target.name)
      bucket &&
        pushOcc(bucket, {
          value,
          kind: "fk",
          table: row.table,
          field: field.name,
          rowPk: row.pk?.value,
          source: row.source,
        })
    }
  }

  // AI : child-table parent_id is an fk even though it is not a ModelField on the child.
  for (const parent of models) {
    const parentTable = sqlTableName(parent.name)
    const col = parentFkField(parentTable)
    if (!(col in row.values)) continue
    if (model && model.fields.some((f) => f.name === col)) continue
    const type = byPkModel.get(parent.id)
    const value = scalarId(row.values[col])
    if (!type || value === undefined) continue
    const bucket = byType.get(type.name)
    bucket &&
      pushOcc(bucket, {
        value,
        kind: "fk",
        table: row.table,
        field: col,
        rowPk: row.pk?.value,
        source: row.source,
      })
  }
}

export type InspectIdsFilter = "all" | "missing" | "unused" | "duplicate"

export type InspectIdsValue = {
  value: string
  status: "ok" | "missing" | "unused" | "duplicate"
  occurrences: IdOccurrence[]
}

export type InspectIdsResult = {
  idTypes: Array<{
    name: sql_id_type_name
    pk: string
    fkFields: string[]
    pkCount: number
    fkCount: number
    missing: number
    unused: number
    duplicate: number
  }>
  values: InspectIdsValue[]
  issues: IdIntegrityIssue[]
}

export function formatInspectIds(index: IdIndex, models: StructureModel[], opts?: {
  idType?: string
  filter?: InspectIdsFilter
}): InspectIdsResult {
  const filter = opts?.filter ?? "all"
  const want = opts?.idType?.trim()
  const types = collectSqlIdTypes(models)
  const buckets = index.buckets.filter((b) => {
    if (!want) return true
    const t = types.find((x) => x.name === b.idType)
    return (
      b.idType === want ||
      t?.pkModelName === want ||
      `${t?.pkModelName}.${t?.pkField}` === want ||
      sqlIdent(t?.pkModelName ?? "") === want
    )
  })
  const idTypes = buckets.map((b) => {
    const t = types.find((x) => x.name === b.idType)
    return {
      name: b.idType,
      pk: `${b.targetModel}.${b.targetField}`,
      fkFields: (t?.fkFields ?? []).map((f) => `${f.modelName}.${f.field}`),
      pkCount: b.pkCount,
      fkCount: b.fkCount,
      missing: b.missing,
      unused: b.unused,
      duplicate: b.duplicate,
    }
  })
  const values: InspectIdsValue[] = []
  for (const bucket of buckets) {
    for (const [value, occs] of [...bucket.values.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const pks = occs.filter((o) => o.kind === "pk")
      const fks = occs.filter((o) => o.kind === "fk")
      let status: InspectIdsValue["status"] = "ok"
      if (pks.length > 1) status = "duplicate"
      else if (fks.length && pks.length === 0) status = "missing"
      else if (pks.length && fks.length === 0) status = "unused"
      if (filter !== "all" && status !== filter) continue
      if (filter === "all" && !want && status === "ok") continue
      values.push({ value, status, occurrences: occs })
    }
  }
  const issues = index.issues.filter((i) => buckets.some((b) => b.idType === i.idType))
  const filteredIssues =
    filter === "all" ? issues : issues.filter((i) => i.kind === `${filter}-pk` || (filter === "duplicate" && i.kind === "duplicate-pk"))
  return { idTypes, values, issues: filteredIssues }
}

export function inspectCatalogDocs(
  models: StructureModel[],
  docs: CatalogDocInput[],
  opts?: { idType?: string; filter?: InspectIdsFilter; typeAliases?: TypeAlias[] },
): InspectIdsResult {
  const catalog = catalogFromDocs(docs, models, opts?.typeAliases)
  return formatInspectIds(buildIdIndex(catalog, models), models, opts)
}
