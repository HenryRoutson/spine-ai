import { parseCsv, sanitizeFieldName } from "@/lib/csv-parse"
import { tryParseJson } from "@/lib/json-utils"
import type { FieldType, InputType, ModelField, StructureModel, StructureModelId } from "@/lib/types"
import type { StructureMatchKind } from "@/lib/structure-match"

export { parseCsv, sanitizeFieldName } from "@/lib/csv-parse"

export type DerivedDocStructure = {
  model: StructureModel
  matchKind: StructureMatchKind
  sheetName?: string
}

function toPascalCase(raw: string): string {
  const parts = raw.replace(/[^\w]+/g, "_").split("_").filter(Boolean)
  if (!parts.length) return "Row"
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("")
}

export function modelNameFromDocFilename(name: string, suffix = "Row"): string {
  const base = name.replace(/\.[^.]+$/, "")
  const pascal = toPascalCase(base)
  return `${pascal}${suffix}`
}

function inferType(val: unknown): FieldType {
  if (typeof val === "boolean") return "bool"
  if (typeof val === "number") return Number.isInteger(val) ? "int" : "float"
  if (Array.isArray(val)) return "list[text]"
  if (val && typeof val === "object") return "json"
  if (typeof val === "string") {
    const t = val.trim()
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      if (tryParseJson(t).ok) return "json"
    }
  }
  return "text"
}

function inferColumnType(values: unknown[]): FieldType {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== "")
  if (!nonEmpty.length) return "text"
  if (nonEmpty.every((v) => typeof v === "boolean")) return "bool"
  if (nonEmpty.every((v) => typeof v === "number" && Number.isInteger(v))) return "int"
  if (nonEmpty.every((v) => typeof v === "number")) return "float"
  if (nonEmpty.every((v) => v && typeof v === "object")) return "json"
  return "text"
}

function inferModelFromRows(
  rows: Record<string, unknown>[],
  name: string,
  id: StructureModelId,
  description: string,
): StructureModel | null {
  if (!rows.length) return null
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  if (!keys.length) return null
  const fields: ModelField[] = keys.map((key, i) => ({
    id: `f_${i}`,
    name: key,
    type: inferColumnType(rows.map((r) => r[key])),
    optional: rows.some((r) => r[key] === null || r[key] === undefined || r[key] === ""),
    description: "",
  }))
  return { id, name, description, auto: true, fields }
}

function inferModelFromObject(
  sample: Record<string, unknown>,
  name: string,
  id: StructureModelId,
): StructureModel {
  const fields: ModelField[] = Object.entries(sample).map(([key, val], i) => ({
    id: `f_${i}`,
    name: sanitizeFieldName(key),
    type: inferType(val),
    optional: val === null || val === undefined || val === "",
    description: "",
  }))
  return {
    id,
    name,
    description: "Auto-generated structure.",
    auto: true,
    fields,
  }
}

function parseDocJson(content: string): unknown | null {
  const parsed = tryParseJson(content.trim())
  return parsed.ok ? parsed.value : null
}

function isRowArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => v && typeof v === "object" && !Array.isArray(v))
  )
}

// AI : infer one or more StructureModels from parsed JSON — tabular arrays become row schemas.
export function inferStructuresFromJson(
  parsed: unknown,
  docName: string,
  idGen: () => StructureModelId,
  opts: { sheetName?: string } = {},
): DerivedDocStructure[] {
  const baseName = opts.sheetName
    ? `${modelNameFromDocFilename(docName, "")}${toPascalCase(opts.sheetName)}Row`
    : modelNameFromDocFilename(docName)

  if (isRowArray(parsed)) {
    const model = inferModelFromRows(
      parsed,
      baseName,
      idGen(),
      opts.sheetName
        ? `Inferred from sheet "${opts.sheetName}" in ${docName}.`
        : `Inferred from ${docName}.`,
    )
    return model ? [{ model, matchKind: "list", sheetName: opts.sheetName }] : []
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 1 && parsed[0] && typeof parsed[0] === "object" && !Array.isArray(parsed[0])) {
      return inferStructuresFromJson(parsed[0], docName, idGen, opts)
    }
    return []
  }

  if (parsed && typeof parsed === "object") {
    const rec = parsed as Record<string, unknown>
    const arrayEntries = Object.entries(rec).filter(([, v]) => isRowArray(v))
    if (arrayEntries.length > 1) {
      return arrayEntries.flatMap(([sheetName, rows]) =>
        inferStructuresFromJson(rows, docName, idGen, { sheetName }),
      )
    }
    const rowLike = Object.values(rec).find(isRowArray)
    if (rowLike) {
      const sheetName = arrayEntries[0]?.[0]
      return inferStructuresFromJson(rowLike, docName, idGen, sheetName ? { sheetName } : opts)
    }
    return [
      {
        model: inferModelFromObject(rec, baseName.replace(/Row$/, "") || baseName, idGen()),
        matchKind: "object",
        sheetName: opts.sheetName,
      },
    ]
  }

  return []
}

export function isTabularDocType(type: InputType, name: string): boolean {
  if (type === "excel" || type === "json") return true
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  return ext === "csv" || ext === "json" || ext === "xlsx" || ext === "xls"
}

// AI : main entry — CSV text, JSON text, or pre-parsed row sets from upload / xlsx.
export function inferStructuresFromDocContent(
  content: string,
  docName: string,
  docType: InputType,
  idGen: () => StructureModelId,
  rowSets?: { name: string; rows: Record<string, unknown>[] }[],
): DerivedDocStructure[] {
  if (rowSets?.length) {
    return rowSets.flatMap(({ name, rows }) =>
      inferStructuresFromJson(rows, docName, idGen, { sheetName: name }),
    )
  }

  const parsed = parseDocJson(content)
  if (parsed !== null) {
    return inferStructuresFromJson(parsed, docName, idGen)
  }

  if (docType === "excel" || docName.toLowerCase().endsWith(".csv")) {
    const rows = parseCsv(content)
    return inferStructuresFromJson(rows, docName, idGen)
  }

  return []
}
