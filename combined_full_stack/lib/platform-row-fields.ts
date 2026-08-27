// AI : friendly row-field display — never dump [] / {} into text boxes.
import { fieldToTypeExpr, TypeExprKind, typeExprRefModelId } from "@/lib/server/type_expr"
import { FieldType, type ModelField, type StructureModel, type StructureModelId } from "@/lib/types"
import { emptyRowData } from "@/lib/platform-row-store"

const LIST_FIELD_TYPES = new Set<FieldType>([
  FieldType.ListText,
  FieldType.ListModel,
  FieldType.ListDocument,
  FieldType.ListTupleTextQuote,
])

export function friendlyFieldName(name: string): string {
  const spaced = name.replace(/_/g, " ").trim()
  if (!spaced) return name
  return spaced.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export function fieldIsList(field: ModelField): boolean {
  if (LIST_FIELD_TYPES.has(field.type)) return true
  return fieldToTypeExpr(field).kind === TypeExprKind.List
}

export function nestedModelIdForField(field: ModelField): StructureModelId | undefined {
  if (field.ref) return field.ref
  return typeExprRefModelId(fieldToTypeExpr(field))
}

export function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function displayScalar(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

export function jsonFieldDisplay(value: unknown): string {
  if (value == null) return ""
  if (Array.isArray(value) && value.length === 0) return ""
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) return ""
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ""
  }
}

export function parseJsonField(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) return {}
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return raw
  }
}

export function parseScalarField(field: ModelField, raw: string): unknown {
  const trimmed = raw.trim()
  if (field.optional && trimmed === "") return null
  if (field.type === FieldType.Int) {
    const n = Number.parseInt(trimmed, 10)
    return Number.isFinite(n) ? n : 0
  }
  if (field.type === FieldType.Float) {
    const n = Number.parseFloat(trimmed)
    return Number.isFinite(n) ? n : 0
  }
  if (field.type === FieldType.Bool) return trimmed === "true" || trimmed === "1" || trimmed === "yes"
  return raw
}

export function newListItem(field: ModelField, models: StructureModel[]): unknown {
  if (field.type === FieldType.ListText || field.type === FieldType.ListDocument) return ""
  const nestedId = nestedModelIdForField(field)
  const nested = nestedId ? models.find((m) => m.id === nestedId) : undefined
  if (nested) return emptyRowData(nested)
  if (field.type === FieldType.ListTupleTextQuote) return ["", ""]
  return {}
}

export function emptyListHint(field: ModelField): string {
  const label = friendlyFieldName(field.name).toLowerCase()
  return `No ${label} yet`
}

export function listItemNoun(field: ModelField): string {
  const label = friendlyFieldName(field.name).toLowerCase()
  return label.replace(/s$/i, "") || "item"
}
