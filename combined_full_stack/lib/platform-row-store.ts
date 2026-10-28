// AI : per-project structure rows — the stateful backend until a site has its own Supabase.
import { appStorageKey } from "@/lib/storage-keys"
import { uid } from "@/lib/id"
import { FieldType, type ProjectId, type StructureModel, type StructureModelId, type project_row_store, type structure_row, type structure_row_id } from "@/lib/types"

export type { project_row_store, structure_row, structure_row_id }

function storageKey(projectId: ProjectId): string {
  return appStorageKey(`backend-rows:${projectId}`)
}

export function emptyRowData(model: StructureModel): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const field of model.fields ?? []) {
    const example = field.examples?.[0]
    if (example !== undefined && example !== "") {
      data[field.name] = parseExample(field.type, example)
      continue
    }
    // AI : list[model] stored as FieldType.Json still seeds [] so the row editor never shows {}.
    if (fieldLooksLikeList(field)) {
      data[field.name] = []
      continue
    }
    data[field.name] = defaultForFieldType(field.type, field.optional)
  }
  return data
}

function fieldLooksLikeList(field: { type: FieldType; typeExpr?: { kind: string } }): boolean {
  if (
    field.type === FieldType.ListText ||
    field.type === FieldType.ListModel ||
    field.type === FieldType.ListDocument ||
    field.type === FieldType.ListTupleTextQuote
  ) {
    return true
  }
  // AI : TypeExprKind.List wire value is "list" — avoid importing type_expr from this client-used store.
  return field.typeExpr?.kind === "list"
}

function parseExample(type: FieldType, raw: string): unknown {
  if (type === FieldType.Int) {
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) ? n : 0
  }
  if (type === FieldType.Float) {
    const n = Number.parseFloat(raw)
    return Number.isFinite(n) ? n : 0
  }
  if (type === FieldType.Bool) return raw === "true" || raw === "1"
  if (type === FieldType.Json || type === FieldType.ListModel || type === FieldType.ListText) {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      return type === FieldType.Json ? raw : []
    }
  }
  return raw
}

function defaultForFieldType(type: FieldType, optional: boolean): unknown {
  if (optional) return null
  switch (type) {
    case FieldType.Int:
    case FieldType.Float:
      return 0
    case FieldType.Bool:
      return false
    case FieldType.ListText:
    case FieldType.ListDocument:
    case FieldType.ListModel:
    case FieldType.ListTupleTextQuote:
      return []
    case FieldType.Json:
      return {}
    default:
      return ""
  }
}

export function readProjectRows(projectId: ProjectId): project_row_store {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as project_row_store
    if (!parsed || typeof parsed !== "object") return {}
    return parsed
  } catch {
    return {}
  }
}

export function writeProjectRows(projectId: ProjectId, store: project_row_store): void {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(projectId), JSON.stringify(store))
}

export function rowsForModel(store: project_row_store, modelId: StructureModelId): structure_row[] {
  return store[modelId] ?? []
}

export function rowsStoreForProject(project: {
  id: ProjectId
  structureRows?: project_row_store
}): project_row_store {
  if (project.structureRows) return project.structureRows
  return readProjectRows(project.id)
}

export function migrateLocalRowsIfNeeded(project: {
  id: ProjectId
  structureRows?: project_row_store
}): project_row_store | null {
  if (project.structureRows !== undefined) return null
  const local = readProjectRows(project.id)
  return Object.keys(local).length > 0 ? local : null
}

export function addStructureRow(
  store: project_row_store,
  model: StructureModel,
  data?: Record<string, unknown>,
): { store: project_row_store; row: structure_row } {
  const row: structure_row = {
    id: uid<structure_row_id>("row_"),
    modelId: model.id,
    data: data ?? emptyRowData(model),
    createdAt: Date.now(),
  }
  const next = { ...store, [model.id]: [...rowsForModel(store, model.id), row] }
  return { store: next, row }
}

export function updateStructureRow(
  store: project_row_store,
  modelId: StructureModelId,
  rowId: structure_row_id,
  data: Record<string, unknown>,
): project_row_store {
  return {
    ...store,
    [modelId]: rowsForModel(store, modelId).map((row) => (row.id === rowId ? { ...row, data } : row)),
  }
}

export function removeStructureRow(
  store: project_row_store,
  modelId: StructureModelId,
  rowId: structure_row_id,
): project_row_store {
  return {
    ...store,
    [modelId]: rowsForModel(store, modelId).filter((row) => row.id !== rowId),
  }
}

export function rowJson(row: structure_row): string {
  return `${JSON.stringify(row.data, null, 2)}\n`
}
