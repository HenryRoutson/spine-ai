// AI : per-project structure rows — the stateful backend until a site has its own Supabase.
import { appStorageKey } from "@/lib/storage-keys"
import { uid } from "@/lib/id"
import { FieldType, type ProjectId, type StructureModel, type StructureModelId } from "@/lib/types"

export type structure_row_id = string & { __brand: "structure_row_id" }

export type structure_row = {
  id: structure_row_id
  modelId: StructureModelId
  data: Record<string, unknown>
  createdAt: number
}

export type project_row_store = Record<string, structure_row[]>

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
    data[field.name] = defaultForFieldType(field.type, field.optional)
  }
  return data
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
