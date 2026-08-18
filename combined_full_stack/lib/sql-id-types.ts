// AI : branded row-id types from ModelField.relation — grep "TODO (sql-id-ref)" / "DONE (sql-id-ref)".
import { modelExportIdentifier, rustFieldIdent } from "@/lib/structure-shape"
import { fieldToTypeExpr, typeExprEqual, TypeExprKind, type TypeExpr } from "@/lib/server/type_expr"
import type { FieldRelation, ModelField, StructureModel, StructureModelId } from "@/lib/types"

export type sql_id_type_name = string & { __brand: "sql_id_type_name" }

export function sqlIdent(name: string): string {
  return rustFieldIdent(modelExportIdentifier(name)).ident
}

export function sqlTableName(modelName: string): string {
  return sqlIdent(modelName)
}

export function declaredPkFields(model: StructureModel): ModelField[] {
  return model.fields.filter((f) => f.relation?.kind === "pk")
}

export function pkFieldOf(model: StructureModel): ModelField | undefined {
  return declaredPkFields(model)[0] ?? model.fields.find((f) => f.name === "id")
}

export function unwrapOptionalExpr(expr: TypeExpr): TypeExpr {
  return expr.kind === TypeExprKind.Optional ? unwrapOptionalExpr(expr.inner) : expr
}

export function idTypeName(model: StructureModel, pkField: ModelField): sql_id_type_name {
  const table = sqlIdent(model.name)
  const col = sqlIdent(pkField.name)
  if (col === "id" || col === `${table}_id`) return `${table}_id_string` as sql_id_type_name
  return `${table}_${col}_string` as sql_id_type_name
}

export function idTypeBrand(name: sql_id_type_name): string {
  return name.endsWith("_string") ? name.slice(0, -7) : name
}

export type SqlIdFkField = { modelId: StructureModelId; modelName: string; field: string }

export type SqlIdType = {
  name: sql_id_type_name
  pkModelId: StructureModelId
  pkModelName: string
  pkField: string
  fkFields: SqlIdFkField[]
}

export function collectSqlIdTypes(models: StructureModel[]): SqlIdType[] {
  const byName = new Map<sql_id_type_name, SqlIdType>()
  for (const model of models) {
    const pk = pkFieldOf(model)
    if (!pk) continue
    const name = idTypeName(model, pk)
    const existing = byName.get(name)
    if (existing) continue
    byName.set(name, {
      name,
      pkModelId: model.id,
      pkModelName: model.name,
      pkField: pk.name,
      fkFields: [],
    })
  }
  for (const model of models) {
    for (const field of model.fields) {
      const rel = field.relation
      if (rel?.kind !== "fk") continue
      const target = models.find((m) => m.id === rel.to.modelId)
      if (!target) continue
      const pk = pkFieldOf(target)
      if (!pk) continue
      const name = idTypeName(target, pk)
      const bucket = byName.get(name)
      if (!bucket) continue
      bucket.fkFields.push({ modelId: model.id, modelName: model.name, field: field.name })
    }
  }
  return [...byName.values()]
}

export function fieldSqlIdType(
  host: StructureModel,
  field: ModelField,
  models: StructureModel[],
): sql_id_type_name | undefined {
  if (field.relation?.kind === "pk") return idTypeName(host, field)
  const rel = field.relation
  if (rel?.kind === "fk") {
    const target = models.find((m) => m.id === rel.to.modelId)
    const pk = target ? pkFieldOf(target) : undefined
    return target && pk ? idTypeName(target, pk) : undefined
  }
  if (field.name === "id" && pkFieldOf(host)?.id === field.id) return idTypeName(host, field)
  return undefined
}

export function fieldRelationLabel(
  field: ModelField,
  models: StructureModel[],
): string {
  const rel = field.relation
  if (rel?.kind === "pk") return "PK"
  if (rel?.kind === "fk") {
    const target = models.find((m) => m.id === rel.to.modelId)
    return target ? `FK → ${target.name}.${rel.to.field}` : `FK → missing`
  }
  return "—"
}

export function parseFkTarget(
  raw: string,
  models: StructureModel[],
): { modelId: StructureModelId; field: string } | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const dot = trimmed.lastIndexOf(".")
  const modelRaw = dot === -1 ? trimmed : trimmed.slice(0, dot)
  const fieldRaw = dot === -1 ? undefined : trimmed.slice(dot + 1)
  const target = models.find((m) => m.name === modelRaw || m.id === modelRaw)
  if (!target) return undefined
  const pk = pkFieldOf(target)
  const field = fieldRaw || pk?.name
  if (!field) return undefined
  return { modelId: target.id, field }
}

export function suggestFieldRelation(
  field: ModelField,
  host: StructureModel,
  models: StructureModel[],
): FieldRelation | undefined {
  if (field.relation) return undefined
  const name = field.name.trim()
  if (!name) return undefined
  if (name === "id" && declaredPkFields(host).length === 0) return { kind: "pk" }
  if (!name.endsWith("_id")) return undefined
  const stem = sqlIdent(name.slice(0, -3))
  const hits = models.filter((m) => m.id !== host.id && sqlIdent(m.name) === stem && pkFieldOf(m))
  if (hits.length !== 1) return undefined
  const target = hits[0]!
  const pk = pkFieldOf(target)!
  return { kind: "fk", to: { modelId: target.id, field: pk.name } }
}

export function fkTypeMatchesPk(field: ModelField, targetPk: ModelField): boolean {
  return typeExprEqual(unwrapOptionalExpr(fieldToTypeExpr(field)), unwrapOptionalExpr(fieldToTypeExpr(targetPk)))
}
