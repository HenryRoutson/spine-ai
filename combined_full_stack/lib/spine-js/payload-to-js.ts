// AI : JSON authoring payload → spine-js source. Seed LLM and few-shot JS use the same printer.
import { kindAlwaysEmitsList } from "@/lib/module-kinds"
import { parseStructureHint } from "@/lib/server/assistant-shared"

function jsString(value: string): string {
  return JSON.stringify(value)
}

const QUOTE_DESC = "tuple[text,quote]"
const QUOTE_LIST_DESC = "list[tuple[text,quote]]"

function fieldToZod(field: Record<string, unknown>): string {
  const type = String(field.type ?? "text")
  const desc = typeof field.description === "string" && field.description ? `.describe(${jsString(field.description)})` : ""
  const optional = field.optional === true ? ".optional()" : ""
  const ref = typeof field.ref === "string" ? field.ref : undefined
  if (type === "document") return `Document${optional}`
  if (type === "list[document]") return `z.array(Document)${optional}`
  if (type === "model" && ref) return `${ref}${optional}`
  if (type === "list[model]" && ref) return `z.array(${ref})${optional}`
  if (type === "tuple[text,quote]") return `z.string().describe(${jsString(QUOTE_DESC)})${optional}`
  if (type === "list[tuple[text,quote]]") return `z.array(z.string()).describe(${jsString(QUOTE_LIST_DESC)})${optional}`
  let core = "z.string()"
  if (type === "int") core = "z.number().int()"
  else if (type === "float") core = "z.number()"
  else if (type === "bool") core = "z.boolean()"
  else if (type === "json") core = "z.unknown()"
  else if (type === "list[text]") core = "z.array(z.string())"
  else if (type.startsWith("list[")) core = "z.array(z.string())"
  return `${core}${desc}${optional}`
}

function schemaExprFor(kind: string, structureOut: string | undefined): string {
  const hint = parseStructureHint(structureOut)
  if (!hint) return "z.object({})"
  const inner = hint.name === "Document" ? "Document" : hint.name
  if (kindAlwaysEmitsList(kind)) return inner
  return hint.isList ? `z.array(${inner})` : inner
}

function inExpr(structureIn: string | undefined): string | undefined {
  const hint = parseStructureHint(structureIn)
  if (!hint) return undefined
  return hint.name === "Document" ? "Document" : hint.name
}

function indent(text: string, n: number): string {
  const pad = "  ".repeat(n)
  return text
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n")
}

function stepToCall(spec: Record<string, unknown>, depth: number): string {
  const kind = String(spec.kind ?? "llm")
  const fn =
    {
      input: "input",
      llm: "llm",
      "llm-batch": "llmBatch",
      "example-select": "exampleSelect",
      "custom-code": "customCode",
      transform: "transform",
      chunk: "chunk",
      merge: "merge",
      output: "output",
      assert: "assertStep",
      "human-review": "humanReview",
      combine: "combine",
      assemble: "assemble",
      fork: "fork",
      "if-else": "ifElse",
      parallel: "parallel",
      connect: "connect",
      n8n: "n8n",
      sql: "sql",
      chatbot: "chatbot",
      webhook: "webhook",
    }[kind] ?? "llm"

  if (kind === "fork") {
    const branches = Array.isArray(spec.forkBranches) ? spec.forkBranches : []
    const branchSrc = branches
      .map((b) => {
        const row = b as { label?: string; modules?: unknown[] }
        const steps = Array.isArray(row.modules) ? row.modules.map((m) => stepToCall(m as Record<string, unknown>, depth + 2)).join(",\n") : ""
        return `{ label: ${jsString(String(row.label ?? "Lane"))}, steps: [\n${steps}\n${"  ".repeat(depth + 1)}] }`
      })
      .join(",\n")
    const fields = [
      spec.label ? `label: ${jsString(String(spec.label))}` : null,
      spec.note ? `note: ${jsString(String(spec.note))}` : null,
      spec.forkJoin ? `join: ${jsString(String(spec.forkJoin))}` : null,
      `branches: [\n${indent(branchSrc, depth + 1)}\n${"  ".repeat(depth)}]`,
    ].filter(Boolean)
    return `${fn}({\n${indent(fields.join(",\n"), depth + 1)}\n${"  ".repeat(depth)}})`
  }

  if (kind === "if-else") {
    const branches = Array.isArray(spec.forkBranches) ? spec.forkBranches : []
    const thenMods = ((branches[0] as { modules?: unknown[] } | undefined)?.modules ?? []) as Record<string, unknown>[]
    const elseMods = ((branches[1] as { modules?: unknown[] } | undefined)?.modules ?? []) as Record<string, unknown>[]
    const cond = spec.ifCondition as { kind?: string; path?: string; value?: unknown } | undefined
    const when =
      cond?.kind === "equals"
        ? `{ kind: "equals", path: ${jsString(String(cond.path ?? ""))}, value: ${JSON.stringify(cond.value)} }`
        : `{ kind: "path", path: ${jsString(String(cond?.path ?? ""))} }`
    const fields = [
      spec.label ? `label: ${jsString(String(spec.label))}` : null,
      spec.note ? `note: ${jsString(String(spec.note))}` : null,
      `when: ${when}`,
      `then: [\n${thenMods.map((m) => stepToCall(m, depth + 2)).join(",\n")}\n${"  ".repeat(depth + 1)}]`,
      elseMods.length ? `else: [\n${elseMods.map((m) => stepToCall(m, depth + 2)).join(",\n")}\n${"  ".repeat(depth + 1)}]` : null,
    ].filter(Boolean)
    return `${fn}({\n${indent(fields.join(",\n"), depth + 1)}\n${"  ".repeat(depth)}})`
  }

  const fields: string[] = []
  if (spec.label) fields.push(`label: ${jsString(String(spec.label))}`)
  if (spec.note) fields.push(`note: ${jsString(String(spec.note))}`)
  if (kind !== "fork" && kind !== "if-else") {
    fields.push(`schema: ${schemaExprFor(kind, typeof spec.structureOut === "string" ? spec.structureOut : undefined)}`)
  }
  const inn = inExpr(typeof spec.structureIn === "string" ? spec.structureIn : undefined)
  if (inn && kind !== "input") fields.push(`in: ${inn}`)
  if (spec.prompt) fields.push(`prompt: ${jsString(String(spec.prompt))}`)
  if (spec.code) fields.push(`code: ${jsString(String(spec.code))}`)
  if (spec.inputType && kind === "input") fields.push(`type: ${jsString(String(spec.inputType))}`)
  if (spec.inputType && kind === "combine") fields.push(`type: ${jsString(String(spec.inputType))}`)
  if (spec.inputNameContains) fields.push(`inputNameContains: ${jsString(String(spec.inputNameContains))}`)
  if (spec.inputDescription) fields.push(`inputDescription: ${jsString(String(spec.inputDescription))}`)
  if (typeof spec.inputMinCount === "number") fields.push(`inputMinCount: ${spec.inputMinCount}`)
  if (spec.assembleBindings) fields.push(`bindings: ${JSON.stringify(spec.assembleBindings)}`)
  if (spec.connectActionId) fields.push(`actionId: ${jsString(String(spec.connectActionId))}`)
  if (spec.connectParameters) fields.push(`parameters: ${JSON.stringify(spec.connectParameters)}`)
  if (spec.n8nNodeType) fields.push(`nodeType: ${jsString(String(spec.n8nNodeType))}`)
  if (spec.n8nParameters) fields.push(`parameters: ${JSON.stringify(spec.n8nParameters)}`)
  if (spec.sql) fields.push(`sql: ${jsString(String(spec.sql))}`)
  if (spec.chatbotMode) fields.push(`mode: ${jsString(String(spec.chatbotMode))}`)
  return `${fn}({\n${indent(fields.join(",\n"), depth + 1)}\n${"  ".repeat(depth)}})`
}

export type SpineJsPayload = {
  message?: string
  modules?: unknown[]
  models?: unknown[]
  docs?: unknown
  documentationUpdate?: string | null
  projectNameUpdate?: string | null
  targetFunctionName?: string | null
}

export function payloadToSpineJs(payload: SpineJsPayload): string {
  const models = Array.isArray(payload.models) ? (payload.models as Record<string, unknown>[]) : []
  const modelLines = models.map((m) => {
    const name = String(m.name ?? "Model")
    const fields = Array.isArray(m.fields) ? (m.fields as Record<string, unknown>[]) : []
    const shape = fields.map((f) => `  ${String(f.name)}: ${fieldToZod(f)}`).join(",\n")
    return `const ${name} = model(${jsString(name)}, {\n${shape}\n})`
  })
  const modules = Array.isArray(payload.modules) ? (payload.modules as Record<string, unknown>[]) : []
  const extras: string[] = []
  if (payload.message) extras.push(`export const message = ${jsString(payload.message)}`)
  if (payload.docs) extras.push(`export const docs = ${JSON.stringify(payload.docs, null, 2)}`)
  if (payload.documentationUpdate) extras.push(`export const documentation = ${jsString(payload.documentationUpdate)}`)
  if (payload.projectNameUpdate) extras.push(`export const projectName = ${jsString(payload.projectNameUpdate)}`)
  if (payload.targetFunctionName) extras.push(`export const targetFunctionName = ${jsString(payload.targetFunctionName)}`)
  return [
    'import { z, model, workflow, input, llm, llmBatch, customCode, combine, assemble, fork, output, Document } from "spine"',
    "",
    ...modelLines,
    "",
    ...extras,
    extras.length ? "" : "",
    "export const main = workflow(async () => {",
    ...modules.map((m) => `  await ${stepToCall(m, 1)}`),
    "})",
    "",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
}
