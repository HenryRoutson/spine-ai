// AI : guided JSON form over JSON Schema — ported from automic_code/edit_given_struct for Testing.

export type SchemaType = "string" | "number" | "integer" | "boolean" | "array" | "object"

export type FormSchemaNode = {
  key: string
  title?: string
  description?: string
  type: SchemaType
  format?: string
  enum?: string[]
  required: boolean
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  minItems?: number
  maxItems?: number
  items?: FormSchemaNode
  properties?: Record<string, FormSchemaNode>
}

export function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function resolveSchemaType(raw: Record<string, unknown>): SchemaType | null {
  const t = raw.type
  if (t === "string" || t === "number" || t === "integer" || t === "boolean" || t === "array" || t === "object") {
    return t
  }
  if (raw.properties) return "object"
  if (raw.items) return "array"
  if (Array.isArray(raw.enum)) return "string"
  return null
}

function normalizeNode(raw: unknown, key: string, required: boolean): FormSchemaNode | null {
  const s = asRecord(raw)
  if (!s) return null
  if ("anyOf" in s || "oneOf" in s || "allOf" in s || "$ref" in s) return null

  const type = resolveSchemaType(s)
  if (!type) return null

  const node: FormSchemaNode = {
    key,
    title: typeof s.title === "string" ? s.title : undefined,
    description: typeof s.description === "string" ? s.description : undefined,
    type,
    required,
  }

  if (typeof s.format === "string") node.format = s.format
  if (Array.isArray(s.enum) && s.enum.every((v) => typeof v === "string")) node.enum = s.enum as string[]
  if (typeof s.minimum === "number") node.minimum = s.minimum
  if (typeof s.maximum === "number") node.maximum = s.maximum
  if (typeof s.minLength === "number") node.minLength = s.minLength
  if (typeof s.maxLength === "number") node.maxLength = s.maxLength
  if (typeof s.pattern === "string") node.pattern = s.pattern
  if (typeof s.minItems === "number") node.minItems = s.minItems
  if (typeof s.maxItems === "number") node.maxItems = s.maxItems

  if (type === "object") {
    const props = asRecord(s.properties)
    if (!props) return null
    const req = Array.isArray(s.required) ? (s.required as string[]) : []
    const properties: Record<string, FormSchemaNode> = {}
    for (const [k, sub] of Object.entries(props)) {
      const child = normalizeNode(sub, k, req.includes(k))
      if (!child) return null
      properties[k] = child
    }
    node.properties = properties
  }

  if (type === "array") {
    const item = normalizeNode(s.items, "item", true)
    if (!item) return null
    node.items = item
  }

  return node
}

// AI : null when the schema is too rich for a guided form — caller falls back to raw JSON.
export function jsonSchemaToFormRoot(schema: Record<string, unknown>): FormSchemaNode | null {
  return normalizeNode(schema, "root", true)
}

// AI : when score/max_score are present, derive correct before generic defaults (SectionGrade-style rows).
function inferScoreCorrectFields(obj: Record<string, unknown>): void {
  const score = obj.score
  const maxScore = obj.max_score
  if (typeof score !== "number" || typeof maxScore !== "number") return
  if (obj.correct === undefined || obj.correct === null) obj.correct = score === maxScore
}

function fieldMissing(val: unknown, type: SchemaType): boolean {
  return val === undefined || val === null || (type !== "boolean" && val === "")
}

// AI : merge missing required keys from schema defaults; keeps partial guided-form rows valid for Zod.
export function applySchemaDefaults(data: unknown, node: FormSchemaNode): unknown {
  if (node.type === "object" && node.properties) {
    const raw =
      data && typeof data === "object" && !Array.isArray(data) ? { ...(data as Record<string, unknown>) } : {}
    inferScoreCorrectFields(raw)
    for (const [k, sub] of Object.entries(node.properties)) {
      const val = raw[k]
      if (fieldMissing(val, sub.type) && sub.required) raw[k] = defaultFromSchema(sub)
      else if (!fieldMissing(val, sub.type) && (sub.type === "object" || sub.type === "array")) {
        raw[k] = applySchemaDefaults(val, sub)
      }
    }
    return raw
  }
  if (node.type === "array" && node.items) {
    if (!Array.isArray(data)) return data
    return data.map((item) => applySchemaDefaults(item, node.items!))
  }
  return data
}

export function defaultFromSchema(node: FormSchemaNode): unknown {
  if (node.type === "object" && node.properties) {
    const o: Record<string, unknown> = {}
    for (const [k, sub] of Object.entries(node.properties)) {
      if (!sub.required) continue
      o[k] = defaultFromSchema(sub)
    }
    return o
  }
  if (node.type === "array") {
    const n = node.minItems ? Math.max(1, node.minItems) : 0
    return Array.from({ length: Math.min(n, 1) }, () => defaultFromSchema(node.items ?? scalarFallback()))
  }
  return exampleScalar(node)
}

function scalarFallback(): FormSchemaNode {
  return { key: "item", type: "string", required: true }
}

function exampleScalar(node: FormSchemaNode): unknown {
  if (node.enum?.length) return node.enum[0]
  if (node.type === "boolean") return false
  if (node.type === "integer") return node.minimum != null ? Math.max(node.minimum, 0) : 0
  if (node.type === "number") return node.minimum != null ? Math.max(node.minimum, 0) : 0
  if (node.format === "email") return "user@example.com"
  if (node.format === "uri") return "https://example.com"
  if (node.format === "date-time") return new Date().toISOString()
  if (node.minLength) return "x".repeat(node.minLength)
  return ""
}

export function friendlyType(node: FormSchemaNode): string {
  if (node.enum) return "Choice"
  if (node.format === "date-time") return "Date & time"
  if (node.format === "email") return "Email"
  if (node.format === "uri") return "URL"
  return (
    {
      string: "Text",
      number: "Number",
      integer: "Number",
      boolean: "Yes / No",
      array: "List",
      object: "Group",
    }[node.type] ?? "Value"
  )
}

export function validateFormData(
  data: unknown,
  node: FormSchemaNode,
  path = "",
): Record<string, string> {
  const errors: Record<string, string> = {}

  if (node.type === "object" && node.properties) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      errors[path || "root"] = "Expected a group of fields"
      return errors
    }
    const obj = data as Record<string, unknown>
    for (const [k, sub] of Object.entries(node.properties)) {
      const p = path ? `${path}.${k}` : k
      const val = obj[k]
      const missing = fieldMissing(val, sub.type)
      if (sub.required && missing) {
        errors[p] = "Required"
        continue
      }
      if (!missing) Object.assign(errors, validateFormData(val, sub, p))
    }
    return errors
  }

  if (node.type === "array") {
    if (!Array.isArray(data)) {
      errors[path] = "Expected a list"
      return errors
    }
    if (node.minItems != null && data.length < node.minItems) errors[path] = `At least ${node.minItems} item(s)`
    if (node.maxItems != null && data.length > node.maxItems) errors[path] = `At most ${node.maxItems} item(s)`
    data.forEach((item, i) =>
      Object.assign(errors, validateFormData(item, node.items ?? scalarFallback(), `${path}[${i}]`)),
    )
    return errors
  }

  if (data === undefined || data === null || data === "") return errors

  if (node.type === "integer" && (!Number.isInteger(data) || typeof data !== "number")) {
    errors[path] = "Must be a whole number"
  }
  if (node.type === "number" && typeof data !== "number") errors[path] = "Must be a number"
  if (node.type === "boolean" && typeof data !== "boolean") errors[path] = "Must be yes or no"
  if (node.type === "string" && typeof data !== "string") errors[path] = "Must be text"

  if (typeof data === "string") {
    if (node.minLength != null && data.length < node.minLength) errors[path] = `At least ${node.minLength} characters`
    if (node.maxLength != null && data.length > node.maxLength) errors[path] = `At most ${node.maxLength} characters`
    if (node.format === "email" && !/^[^@]+@[^@]+\.[^@]+$/.test(data)) errors[path] = "Invalid email"
    if (node.format === "uri" && !/^https?:\/\/.+/.test(data)) errors[path] = "Invalid URL"
    if (node.pattern) {
      try {
        if (!new RegExp(node.pattern).test(data)) errors[path] = "Invalid format"
      } catch {
        /* skip bad pattern */
      }
    }
    if (node.enum && !node.enum.includes(data)) errors[path] = "Pick a valid option"
  }

  if (typeof data === "number") {
    if (node.minimum != null && data < node.minimum) errors[path] = `Minimum ${node.minimum}`
    if (node.maximum != null && data > node.maximum) errors[path] = `Maximum ${node.maximum}`
  }

  return errors
}
