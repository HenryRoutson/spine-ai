// AI : JSON authoring payload → workflow() TypeScript. Few-shot retrieval uses this, not the node graph.
import type { SpineJsPayload } from "./payload-to-js"

function jsString(value: string): string {
  return JSON.stringify(value)
}

function fieldToZod(field: Record<string, unknown>): string {
  const type = String(field.type ?? "text")
  const desc = typeof field.description === "string" && field.description ? `.describe(${jsString(field.description)})` : ""
  const optional = field.optional === true ? ".optional()" : ""
  const ref = typeof field.ref === "string" ? field.ref : undefined
  if (type === "model" && ref) return `${ref}${optional}`
  if (type === "list[model]" && ref) return `z.array(${ref})${optional}`
  if (type === "document") return `Document${optional}`
  if (type === "int") return `z.number().int()${desc}${optional}`
  if (type === "float") return `z.number()${desc}${optional}`
  if (type === "bool") return `z.boolean()${desc}${optional}`
  if (type === "json") return `z.unknown()${desc}${optional}`
  if (type === "list[text]") return `z.array(z.string())${desc}${optional}`
  if (type === "tuple[text,quote]" || type.startsWith("tuple[")) {
    return `z.object({ text: z.string(), quote: z.string().optional() })${optional}`
  }
  if (type === "list[tuple[text,quote]]" || type.startsWith("list[tuple[")) {
    return `z.array(z.object({ text: z.string(), quote: z.string().optional() }))${optional}`
  }
  return `z.string()${desc}${optional}`
}

function kindsOf(modules: unknown[]): string[] {
  return modules.map((m) => String((m as { kind?: unknown }).kind ?? ""))
}

function findStep(modules: unknown[], kind: string): Record<string, unknown> | undefined {
  return modules.find((m) => (m as { kind?: unknown }).kind === kind) as Record<string, unknown> | undefined
}

function walkModules(modules: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const raw of modules) {
    const m = raw as Record<string, unknown>
    out.push(m)
    if (Array.isArray(m.forkBranches)) {
      for (const b of m.forkBranches as Array<{ modules?: unknown[] }>) {
        if (Array.isArray(b.modules)) out.push(...walkModules(b.modules))
      }
    }
  }
  return out
}

function toIdent(label: string, used: Set<string>): string {
  const name = label.replace(/[^A-Za-z0-9]+/g, " ").trim()
  const base =
    name
      .split(" ")
      .map((w, i) => (i === 0 ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1)))
      .join("")
      .replace(/^\d/, "fn$&") || "extract"
  let ident = base
  let i = 2
  while (used.has(ident)) {
    ident = `${base}${i}`
    i += 1
  }
  used.add(ident)
  return ident
}

export function payloadToWorkflow(payload: SpineJsPayload): string {
  const models = Array.isArray(payload.models) ? (payload.models as Record<string, unknown>[]) : []
  const modules = Array.isArray(payload.modules) ? payload.modules : []
  const kinds = kindsOf(modules)
  const modelLines = models.map((m) => {
    const name = String(m.name ?? "Model")
    const fields = Array.isArray(m.fields) ? (m.fields as Record<string, unknown>[]) : []
    const shape = fields.map((f) => `  ${String(f.name)}: ${fieldToZod(f)}`).join(",\n")
    return `const ${name} = model(${jsString(name)}, {\n${shape}\n})`
  })
  const llmSteps = walkModules(modules).filter((m) => {
    const kind = String(m.kind ?? "")
    return kind === "llm" || kind === "llm-batch"
  })
  const usedIdents = new Set<string>()
  const fns: string[] = []
  for (const spec of llmSteps) {
    const ident = toIdent(String(spec.label ?? "extract"), usedIdents)
    const out = String(spec.structureOut ?? "Out").replace(/^list\[(.+)\]$/i, "$1")
    const prompt = String(spec.prompt ?? "Extract the fields.")
    const note = String(spec.note ?? spec.label ?? "Extract.")
    const listOut = /^list\[/i.test(String(spec.structureOut ?? ""))
    const schemaExpr = listOut ? `z.array(${out})` : out
    fns.push(
      `async function ${ident}(doc: { filename: string; content?: string }) {\n  return generateObject({\n    schema: ${schemaExpr},\n    prompt: ${jsString(prompt)},\n    note: ${jsString(note)},\n  })\n}`,
    )
  }
  const firstFn = fns[0]?.match(/async function (\w+)/)?.[1] ?? "extract"
  let body: string
  if (kinds.includes("fork")) {
    const forkFns = fns.slice(0, -1).map((fn) => fn.match(/async function (\w+)/)?.[1]).filter(Boolean)
    const memoFn = fns[fns.length - 1]?.match(/async function (\w+)/)?.[1] ?? "writeMemo"
    const calls = forkFns.map((name) => `task(${name})(doc)`).join(",\n    ")
    body = `export const main = workflow(async (doc) => {
  const parts = await Promise.all([
    ${calls}
  ])
  return await task(${memoFn})({ parts })
})`
  } else if (kinds.includes("assemble")) {
    const batchFn = firstFn
    const jobFn = fns[1]?.match(/async function (\w+)/)?.[1] ?? firstFn
    body = `export const main = workflow(async (resumes, jobDoc) => {
  const parsed = []
  for (const file of resumes) parsed.push(await task(${batchFn})(file))
  const job = await task(${jobFn})(jobDoc)
  return { resumes: parsed, job_desc: job }
})`
  } else if (kinds.includes("combine")) {
    const auditFn = fns[0]?.match(/async function (\w+)/)?.[1] ?? firstFn
    const parse = findStep(modules, "custom-code")
    const parseCode = String(parse?.code ?? "(doc) => doc")
    body = `export const main = workflow(async (policy, expenseReport) => {
  const policyRows = await step("Parse Policy Table", () => {
    const fn = ${parseCode}
    return fn(policy)
  })
  return await task(${auditFn})({ policyRows, expenseReport })
})`
  } else if (kinds.includes("custom-code") && kinds.includes("llm-batch") && kinds.filter((k) => k === "custom-code").length >= 2) {
    const split = modules.find((m) => (m as { kind?: string }).kind === "custom-code") as Record<string, unknown>
    const join = [...modules].reverse().find((m) => (m as { kind?: string }).kind === "custom-code") as Record<string, unknown>
    body = `export const main = workflow(async (doc) => {
  const chunks = await step(${jsString(String(split?.label ?? "split"))}, () => {
    const fn = ${String(split?.code ?? "(d) => [d]")}
    return fn(doc)
  })
  const rows = []
  for (const chunk of chunks) rows.push(await task(${firstFn})(chunk))
  return step(${jsString(String(join?.label ?? "join"))}, () => {
    const fn = ${String(join?.code ?? "(rows) => rows")}
    return fn(rows)
  })
})`
  } else if (kinds.includes("custom-code") && kinds.includes("llm-batch")) {
    const flat = findStep(modules, "custom-code")
    body = `export const main = workflow(async (files) => {
  const notes = []
  for (const file of files) notes.push(await task(${firstFn})(file))
  return notes.flatMap(${String(flat?.code ?? "(n) => n.items").replace(/^\(notes\)\s*=>\s*notes\.flatMap/, "") || "(n) => n.items"})
})`
  } else {
    body = `export const main = workflow(async (files) => {
  const rows = []
  for (const file of files) rows.push(await task(${firstFn})(file))
  return rows
})`
  }
  const extras: string[] = []
  if (payload.message) extras.push(`export const message = ${jsString(payload.message)}`)
  if (payload.docs) extras.push(`export const docs = ${JSON.stringify(payload.docs, null, 2)}`)
  if (payload.documentationUpdate) extras.push(`export const documentation = ${jsString(payload.documentationUpdate)}`)
  if (payload.projectNameUpdate) extras.push(`export const projectName = ${jsString(payload.projectNameUpdate)}`)
  if (payload.targetFunctionName) extras.push(`export const targetFunctionName = ${jsString(payload.targetFunctionName)}`)
  return [
    'import { z, model, workflow, task, step, generateObject, Document } from "spine"',
    "",
    ...modelLines,
    "",
    ...fns,
    "",
    ...extras,
    extras.length ? "" : "",
    body,
    "",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
}
