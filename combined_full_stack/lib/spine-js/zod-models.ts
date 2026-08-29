// AI : Zod object ↔ structure model name. Each spine-js step takes one Zod I/O schema.
import { z, type ZodType } from "zod"
import type { PipelineAssistantModelSpec } from "@/lib/server/pipeline-authoring-schema"

const namedModels = new WeakMap<ZodType, string>()
const modelRegistry = new Map<string, PipelineAssistantModelSpec>()

const BUILTIN_NAMES = new Set([
  "Document",
  "QuoteSpan",
  "ChatbotPrompt",
  "ChatbotTurn",
  "ChatbotResult",
  "VideoClip",
  "AudioClip",
  "ImageStill",
])

export function isBuiltinStructureName(name: string): boolean {
  return BUILTIN_NAMES.has(name)
}

export function isZodType(value: unknown): value is ZodType {
  return !!value && typeof value === "object" && typeof (value as { parse?: unknown }).parse === "function"
}

export const zodTypeSchema: z.ZodType<ZodType> = z.custom<ZodType>(isZodType, "expected a Zod schema")

export function rememberModelName(schema: ZodType, name: string): void {
  namedModels.set(schema, name)
}

export function modelNameOf(schema: ZodType): string | undefined {
  return namedModels.get(schema)
}

export function resetSpineJsModels(): void {
  modelRegistry.clear()
}

export type StructureRef = {
  name: string
  isList: boolean
  models: PipelineAssistantModelSpec[]
}

function jsonSchemaType(node: Record<string, unknown> | undefined): string | undefined {
  const t = node?.type
  if (typeof t === "string") return t
  if (Array.isArray(t)) return t.find((x) => x !== "null") as string | undefined
  return undefined
}

function typeNameCandidate(raw: string | undefined, fallback: string): string {
  if (raw && /^[A-Z][A-Za-z0-9_]*$/.test(raw)) return raw
  return fallback
}

function isDocumentJsonSchema(node: Record<string, unknown>): boolean {
  const props = node.properties as Record<string, unknown> | undefined
  if (!props) return false
  return "filename" in props && "content" in props
}

function fieldTypeFromJsonSchema(node: Record<string, unknown>): {
  type: string
  ref?: string
  nested?: PipelineAssistantModelSpec[]
} {
  const tagged = typeof node.description === "string" ? node.description : ""
  if (tagged === "tuple[text,quote]") return { type: "tuple[text,quote]" }
  if (tagged === "list[tuple[text,quote]]") return { type: "list[tuple[text,quote]]" }
  const t = jsonSchemaType(node)
  if (t === "integer") return { type: "int" }
  if (t === "number") return { type: "float" }
  if (t === "boolean") return { type: "bool" }
  if (t === "array") {
    const items = (node.items ?? {}) as Record<string, unknown>
    if (typeof items.description === "string" && items.description === "tuple[text,quote]") {
      return { type: "list[tuple[text,quote]]" }
    }
    const innerT = jsonSchemaType(items)
    if (innerT === "string") return { type: "list[text]" }
    if (isDocumentJsonSchema(items)) return { type: "list[document]" }
    if (innerT === "object" || items.properties) {
      const nested = modelSpecFromJsonSchema(items, typeNameCandidate(typeof items.description === "string" ? items.description : undefined, "Item"))
      return { type: "list[model]", ref: nested.name, nested: [nested] }
    }
    return { type: "json" }
  }
  if (isDocumentJsonSchema(node)) return { type: "document" }
  if (t === "object" || node.properties) {
    const nested = modelSpecFromJsonSchema(node, typeNameCandidate(typeof node.description === "string" ? node.description : undefined, "Nested"))
    return { type: "model", ref: nested.name, nested: [nested] }
  }
  if (t === "string") return { type: "text" }
  return { type: "json" }
}

function modelSpecFromJsonSchema(node: Record<string, unknown>, fallbackName: string): PipelineAssistantModelSpec {
  const name =
    (typeof node.description === "string" && /^[A-Z][A-Za-z0-9_]*$/.test(node.description) ? node.description : fallbackName) ||
    fallbackName
  const props = (node.properties ?? {}) as Record<string, Record<string, unknown>>
  const required = new Set(Array.isArray(node.required) ? (node.required as string[]) : [])
  const fields: PipelineAssistantModelSpec["fields"] = []
  const nested: PipelineAssistantModelSpec[] = []
  for (const [fieldName, prop] of Object.entries(props)) {
    const mapped = fieldTypeFromJsonSchema(prop)
    if (mapped.nested) nested.push(...mapped.nested)
    fields.push({
      name: fieldName,
      type: mapped.type,
      optional: !required.has(fieldName),
      description: typeof prop.description === "string" ? prop.description : "",
      ...(mapped.ref ? { ref: mapped.ref } : {}),
    })
  }
  const spec: PipelineAssistantModelSpec = {
    name,
    description: typeof node.description === "string" && node.description !== name ? node.description : "",
    fields,
  }
  return spec
}

function registerModel(spec: PipelineAssistantModelSpec): void {
  if (isBuiltinStructureName(spec.name)) return
  const prev = modelRegistry.get(spec.name)
  if (!prev) {
    modelRegistry.set(spec.name, spec)
    return
  }
  if ((spec.fields?.length ?? 0) > (prev.fields?.length ?? 0)) modelRegistry.set(spec.name, spec)
}

export function model(name: string, shape: Record<string, ZodType>): ZodType {
  const schema = z.object(shape).describe(name)
  rememberModelName(schema, name)
  const json = z.toJSONSchema(schema) as Record<string, unknown>
  const spec = modelSpecFromJsonSchema({ ...json, description: name }, name)
  spec.name = name
  spec.description = ""
  registerModel(spec)
  return schema
}

export function unwrapZodList(schema: ZodType): { inner: ZodType; isList: boolean } {
  if (schema.type === "array") {
    const inner = (schema as unknown as { def: { element: ZodType } }).def.element
    if (isZodType(inner)) return { inner, isList: true }
  }
  return { inner: schema, isList: false }
}

export function structureRefFromZod(schema: ZodType, fallbackName: string): StructureRef {
  const { inner, isList } = unwrapZodList(schema)
  const remembered = modelNameOf(inner)
  const json = z.toJSONSchema(inner) as Record<string, unknown>
  const name = remembered ?? (typeof json.description === "string" && /^[A-Z][A-Za-z0-9_]*$/.test(json.description) ? json.description : fallbackName)
  rememberModelName(inner, name)
  if (!isBuiltinStructureName(name) && inner.type === "object") {
    const spec = modelSpecFromJsonSchema({ ...json, description: name }, name)
    spec.name = name
    registerModel(spec)
  }
  return { name, isList, models: collectedModels() }
}

export function collectedModels(): PipelineAssistantModelSpec[] {
  return [...modelRegistry.values()]
}

export function formatStructureOut(kind: string, ref: StructureRef): string {
  if (kind === "llm-batch" || kind === "example-select" || kind === "chunk") return ref.name
  return ref.isList ? `list[${ref.name}]` : ref.name
}

export function formatStructureIn(kind: string, ref: StructureRef): string {
  if (kind === "llm-batch" || kind === "example-select" || kind === "chunk") return ref.name
  return ref.isList ? `list[${ref.name}]` : ref.name
}

export function itemNameOfOut(structureOut: string | undefined): string | undefined {
  if (!structureOut?.trim()) return undefined
  const m = /^list\[(.+)\]$/i.exec(structureOut.trim())
  return (m ? m[1] : structureOut).trim()
}
