// AI : immutable doc edits — fork to a new name; guided form schema from matched structures or value shape.

import { z } from "zod"
import { isTabularDocType } from "@/lib/doc-structure-infer"
import { tryParseJson } from "@/lib/json-utils"
import { findMatchingStructures } from "@/lib/structure-match"
import { zodFromModel } from "@/lib/server/structure"
import { InputType, type DocRef, type StructureModel, type TypeAlias } from "@/lib/types"

export function isStructuredEditableDoc(doc: Pick<DocRef, "name" | "type">): boolean {
  return isTabularDocType(doc.type, doc.name) || doc.type === InputType.Json
}

export function suggestEditDocName(sourceName: string, existing: Pick<DocRef, "name">[]): string {
  const taken = new Set(existing.map((d) => d.name))
  const dot = sourceName.lastIndexOf(".")
  const stem = dot > 0 ? sourceName.slice(0, dot) : sourceName
  const ext = dot > 0 ? sourceName.slice(dot) : ".json"
  const base = stem.replace(/_edit\d*$/, "")
  for (let n = 1; ; n++) {
    const name = n === 1 ? `${base}_edit${ext}` : `${base}_edit${n}${ext}`
    if (!taken.has(name) && name !== sourceName) return name
  }
}

export function validateNewDocName(
  name: string,
  sourceName: string,
  existing: Pick<DocRef, "name">[],
): string | null {
  const trimmed = name.trim()
  if (!trimmed) return "New file name is required"
  if (trimmed === sourceName) return "Choose a new name — files are immutable"
  if (existing.some((d) => d.name === trimmed)) return `A file named ${trimmed} already exists`
  return null
}

function inferLooseJsonSchema(value: unknown, key = "root"): Record<string, unknown> {
  if (value === null) return { type: "string", nullable: true }
  if (typeof value === "boolean") return { type: "boolean" }
  if (typeof value === "number") return { type: Number.isInteger(value) ? "integer" : "number" }
  if (typeof value === "string") return { type: "string" }
  if (Array.isArray(value)) {
    const sample = value.find((v) => v !== null && v !== undefined)
    return {
      type: "array",
      items: sample === undefined ? { type: "string" } : inferLooseJsonSchema(sample, "item"),
    }
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    const properties: Record<string, unknown> = {}
    const required: string[] = []
    for (const [k, v] of entries) {
      properties[k] = inferLooseJsonSchema(v, k)
      if (v !== null && v !== undefined) required.push(k)
    }
    return {
      type: "object",
      title: key === "root" ? undefined : key,
      properties,
      required,
      additionalProperties: false,
    }
  }
  return { type: "string" }
}

export type DocEditSchemaInfo = {
  schema: Record<string, unknown>
  modelName: string | null
  parseError: string | null
  value: unknown | null
}

export function docEditSchemaFromContent(
  content: string,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): DocEditSchemaInfo {
  const parsed = tryParseJson(content, { trim: true })
  if (!parsed.ok) {
    return { schema: { type: "object", properties: {} }, modelName: null, parseError: parsed.error.message, value: null }
  }
  const value = parsed.value
  const matches = findMatchingStructures(value, models, typeAliases)
  const best = matches[0]
  if (best) {
    const model = models.find((m) => m.id === best.modelId)
    if (model) {
      let schemaZod = zodFromModel(model, models, typeAliases)
      if (best.matchKind === "list") schemaZod = z.array(schemaZod)
      return {
        schema: z.toJSONSchema(schemaZod) as Record<string, unknown>,
        modelName: model.name,
        parseError: null,
        value,
      }
    }
  }
  return {
    schema: inferLooseJsonSchema(value),
    modelName: null,
    parseError: null,
    value,
  }
}
