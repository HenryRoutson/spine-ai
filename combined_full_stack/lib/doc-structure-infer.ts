import { parseCsv, sanitizeFieldName } from "@/lib/csv-parse"
import { tryParseJson } from "@/lib/json-utils"
import type { FieldType, InputType, ModelField, StructureModel, StructureModelId } from "@/lib/types"
import type { StructureMatchKind } from "@/lib/structure-match"

export { parseCsv, sanitizeFieldName } from "@/lib/csv-parse"

export type DerivedDocStructure = {
  model: StructureModel
  companionModels: StructureModel[]
  sample: unknown
  matchKind: StructureMatchKind
  sheetName?: string
}

type InferBundle = {
  root: StructureModel
  companions: StructureModel[]
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

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return !!val && typeof val === "object" && !Array.isArray(val)
}

function inferScalarType(val: unknown): FieldType {
  if (typeof val === "boolean") return "bool"
  if (typeof val === "number") return Number.isInteger(val) ? "int" : "float"
  if (typeof val === "string") {
    const t = val.trim()
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      if (tryParseJson(t).ok) return "json"
    }
  }
  return "text"
}

function inferListElementType(values: unknown[]): FieldType {
  const flat = values.flatMap((v) => (Array.isArray(v) ? v : [v]))
  const nonEmpty = flat.filter((v) => v !== null && v !== undefined && v !== "")
  if (!nonEmpty.length) return "list[text]"
  if (nonEmpty.every((v) => typeof v === "boolean")) return "list[text]"
  if (nonEmpty.every((v) => typeof v === "number")) return "list[text]"
  if (nonEmpty.every((v) => typeof v === "string")) return "list[text]"
  return "list[text]"
}

function nestedModelName(parentName: string, key: string): string {
  const suffix = toPascalCase(sanitizeFieldName(key))
  if (parentName.endsWith(suffix)) {
    // AI : recursive field (subsections → …Subsections) — must not reuse the parent model name.
    return `${parentName}Item`
  }
  return `${parentName}${suffix}`
}

function mergeObjectSamples(values: Record<string, unknown>[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  for (const row of values) {
    for (const [key, val] of Object.entries(row)) {
      if (merged[key] === undefined && val !== undefined) merged[key] = val
    }
  }
  return merged
}

const MAPPING_RULE_NAME = "MappingRule"
const MAPPING_RULE_KEYS = new Set(["source", "transform", "default", "optional"])

function isMappingRuleObject(val: Record<string, unknown>): boolean {
  const keys = Object.keys(val)
  return keys.length > 0 && keys.every((k) => MAPPING_RULE_KEYS.has(k))
}

function ensureMappingRuleCompanion(
  val: Record<string, unknown>,
  idGen: () => StructureModelId,
  companions: StructureModel[],
): StructureModelId {
  const hit = companions.find((c) => c.name === MAPPING_RULE_NAME)
  if (hit) return hit.id
  const child = inferModelsFromObject(val, MAPPING_RULE_NAME, idGen(), idGen)
  companions.push(...child.companions, child.root)
  return child.root.id
}

// AI : recursively infer nested model / list[model] refs — avoid json except for serialized strings.
function inferFieldFromValue(
  key: string,
  val: unknown,
  parentName: string,
  idGen: () => StructureModelId,
  companions: StructureModel[],
): ModelField {
  const name = sanitizeFieldName(key)
  const optional = val === null || val === undefined || val === ""

  if (Array.isArray(val)) {
    const objects = val.filter(isPlainObject)
    if (objects.length > 0 && objects.length === val.filter((v) => v !== null && v !== undefined).length) {
      const childName = nestedModelName(parentName, key)
      const child = inferModelsFromObject(mergeObjectSamples(objects), childName, idGen(), idGen)
      companions.push(...child.companions, child.root)
      return {
        id: `f_${name}`,
        name,
        type: "list[model]",
        ref: child.root.id,
        optional,
        description: "",
      }
    }
    return {
      id: `f_${name}`,
      name,
      type: inferListElementType(val),
      optional,
      description: "",
    }
  }

  if (isPlainObject(val)) {
    if (isMappingRuleObject(val)) {
      return {
        id: `f_${name}`,
        name,
        type: "model",
        ref: ensureMappingRuleCompanion(val, idGen, companions),
        optional,
        description: "",
      }
    }
    const childName = nestedModelName(parentName, key)
    const child = inferModelsFromObject(val, childName, idGen(), idGen)
    companions.push(...child.companions, child.root)
    return {
      id: `f_${name}`,
      name,
      type: "model",
      ref: child.root.id,
      optional,
      description: "",
    }
  }

  return {
    id: `f_${name}`,
    name,
    type: inferScalarType(val),
    optional,
    description: "",
  }
}

function inferModelsFromObject(
  sample: Record<string, unknown>,
  name: string,
  id: StructureModelId,
  idGen: () => StructureModelId,
  description = "Auto-generated structure.",
): InferBundle {
  const companions: StructureModel[] = []
  const fields: ModelField[] = Object.entries(sample).map(([key, val], i) => {
    const field = inferFieldFromValue(key, val, name, idGen, companions)
    return { ...field, id: `f_${i}` }
  })
  return {
    root: { id, name, description, auto: true, fields },
    companions,
  }
}

function inferModelsFromRows(
  rows: Record<string, unknown>[],
  name: string,
  id: StructureModelId,
  description: string,
  idGen: () => StructureModelId,
): InferBundle | null {
  if (!rows.length) return null
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  if (!keys.length) return null

  const companions: StructureModel[] = []
  const fields: ModelField[] = keys.map((key, i) => {
    const values = rows.map((r) => r[key])
    const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== "")
    const optional = values.some((v) => v === null || v === undefined || v === "")

    const objects = nonEmpty.filter(isPlainObject) as Record<string, unknown>[]
    if (objects.length > 0 && objects.length === nonEmpty.length) {
      const childName = nestedModelName(name, key)
      const child = inferModelsFromObject(mergeObjectSamples(objects), childName, idGen(), idGen)
      companions.push(...child.companions, child.root)
      return {
        id: `f_${i}`,
        name: key,
        type: "list[model]" as const,
        ref: child.root.id,
        optional,
        description: "",
      }
    }

    const arrays = nonEmpty.filter(Array.isArray)
    if (arrays.length > 0 && arrays.length === nonEmpty.length) {
      const nestedObjects = arrays.flatMap((a) => a.filter(isPlainObject)) as Record<string, unknown>[]
      if (nestedObjects.length > 0) {
        const childName = nestedModelName(name, key)
        const child = inferModelsFromObject(mergeObjectSamples(nestedObjects), childName, idGen(), idGen)
        companions.push(...child.companions, child.root)
        return {
          id: `f_${i}`,
          name: key,
          type: "list[model]" as const,
          ref: child.root.id,
          optional,
          description: "",
        }
      }
      return {
        id: `f_${i}`,
        name: key,
        type: inferListElementType(arrays),
        optional,
        description: "",
      }
    }

    return {
      id: `f_${i}`,
      name: key,
      type: inferScalarType(nonEmpty[0]),
      optional,
      description: "",
    }
  })

  return {
    root: { id, name, description, auto: true, fields },
    companions,
  }
}

function toDerived(
  bundle: InferBundle,
  sample: unknown,
  matchKind: StructureMatchKind,
  sheetName?: string,
): DerivedDocStructure {
  return {
    model: bundle.root,
    companionModels: bundle.companions,
    sample,
    matchKind,
    sheetName,
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
    const bundle = inferModelsFromRows(
      parsed,
      baseName,
      idGen(),
      opts.sheetName
        ? `Inferred from sheet "${opts.sheetName}" in ${docName}.`
        : `Inferred from ${docName}.`,
      idGen,
    )
    return bundle ? [toDerived(bundle, parsed, "list", opts.sheetName)] : []
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 1 && isPlainObject(parsed[0])) {
      return inferStructuresFromJson(parsed[0], docName, idGen, opts)
    }
    return []
  }

  if (parsed && typeof parsed === "object") {
    const rec = parsed as Record<string, unknown>
    const onlyFields =
      Object.keys(rec).length === 1 && isPlainObject(rec.fields) ? (rec.fields as Record<string, unknown>) : null
    if (onlyFields) {
      return inferStructuresFromJson(onlyFields, docName, idGen, opts)
    }
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
    const bundle = inferModelsFromObject(
      rec,
      baseName.replace(/Row$/, "") || baseName,
      idGen(),
      idGen,
      `Inferred from ${docName}.`,
    )
    return [toDerived(bundle, rec, "object", opts.sheetName)]
  }

  return []
}

export function isTabularDocType(type: InputType, name: string): boolean {
  if (type === "excel" || type === "json") return true
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  return ext === "csv" || ext === "json" || ext === "xlsx" || ext === "xls"
}

// AI : main entry — runs on any stored doc text (seed, upload, or re-opened from store).
export function inferStructuresFromDocContent(
  content: string,
  docName: string,
  docType: InputType,
  idGen: () => StructureModelId,
  rowSets?: { name: string; rows: Record<string, unknown>[] }[],
): DerivedDocStructure[] {
  const trimmed = content.trim()
  if (!trimmed) return []

  if (rowSets?.length) {
    return rowSets.flatMap(({ name, rows }) =>
      inferStructuresFromJson(rows, docName, idGen, { sheetName: name }),
    )
  }

  const parsed = parseDocJson(trimmed)
  if (parsed !== null) {
    return inferStructuresFromJson(parsed, docName, idGen)
  }

  const rows = parseCsv(trimmed)
  if (rows.length) return inferStructuresFromJson(rows, docName, idGen)

  const prose = inferPlainTextDocSample(trimmed, docName, docType)
  if (prose) {
    return inferStructuresFromJson(prose, docName, idGen)
  }

  return []
}

// AI : markdown / plain-text uploads — one text field keyed by the first H1 (or filename).
function inferPlainTextDocSample(
  content: string,
  docName: string,
  docType: InputType,
): Record<string, unknown> | null {
  if (docType !== "text") return null
  const ext = docName.split(".").pop()?.toLowerCase() ?? ""
  if (ext !== "md" && ext !== "txt") return null

  const h1 = content.split(/\r?\n/).find((l) => /^#\s+\S/.test(l))
  const title = h1?.replace(/^#\s+/, "").trim() ?? docName.replace(/\.[^.]+$/, "")
  const key = sanitizeFieldName(h1 ?? title)
  return { [key]: content }
}

export function isInferrableDocContent(
  content: string,
  docName: string,
  docType: InputType,
): boolean {
  return (
    inferStructuresFromDocContent(content, docName, docType, () => "infer_probe" as StructureModelId)
      .length > 0
  )
}
