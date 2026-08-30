import { describe, expect, it } from "vitest"
import { compileSpineJs } from "@/lib/spine-js/compile"
import { semanticCheckProgram } from "@/lib/spine-js/semantic-check"
import { programToContractDts } from "@/lib/spine-js/contract"

const receiptWorkflow = `
import { z, model, workflow, task, generateObject, Document } from "spine"

const ReceiptRow = model("ReceiptRow", {
  date: z.string().describe("Receipt date"),
  vendor: z.string().describe("Vendor name"),
  amount: z.number().describe("Total amount"),
})

async function extractReceipt(doc: { filename: string; content?: string }) {
  return generateObject({
    schema: ReceiptRow,
    prompt: "Extract date, vendor, and total amount from this receipt text.",
    note: "One structured ReceiptRow per uploaded Document.",
  })
}

export const message = "I'll add a receipt extractor."
export const docs = [
  { name: "receipt_coffee.txt", type: "text", content: "COFFEE SHOP" },
  { name: "receipt_taxi.txt", type: "text", content: "CITY TAXI" },
]
export const projectName = "Receipt to Spreadsheet"

export const main = workflow(async (files: Array<{ filename: string; content?: string }>) => {
  const rows = []
  for (const file of files) {
    rows.push(await task(extractReceipt)(file))
  }
  return rows
})
`

describe("workflow-as-code compiler", () => {
  it("compiles a for-loop + generateObject into input → llm-batch → output", () => {
    const compiled = compileSpineJs(receiptWorkflow)
    expect(compiled.ok, compiled.ok ? "" : compiled.errors.join("; ")).toBe(true)
    if (!compiled.ok) return
    expect(compiled.program.modules.map((m) => m.kind)).toEqual(["input", "llm-batch", "output"])
    expect(compiled.program.modules[0]?.structureOut).toBe("list[Document]")
    expect(compiled.program.modules[1]?.structureIn).toBe("Document")
    expect(compiled.program.modules[1]?.structureOut).toBe("ReceiptRow")
    expect(compiled.program.models.some((m) => m.name === "ReceiptRow")).toBe(true)
  })

  it("turns Promise.all of tasks into a fork", () => {
    const compiled = compileSpineJs(`
      const Risk = model("Risk", { text: z.string() })
      const Party = model("Party", { name: z.string() })
      const Memo = model("DiligenceMemo", { content: z.string() })
      async function extractRisks(doc) {
        return generateObject({ schema: z.array(Risk), prompt: "Extract each risk.", note: "Risk quotes" })
      }
      async function extractParties(doc) {
        return generateObject({ schema: z.array(Party), prompt: "Extract each party.", note: "Party quotes" })
      }
      async function writeMemo(product) {
        return generateObject({ schema: Memo, prompt: "Write a memo.", note: "Memo from the fork product." })
      }
      export const main = workflow(async (doc) => {
        const [risks, parties] = await Promise.all([
          task(extractRisks)(doc),
          task(extractParties)(doc),
        ])
        return await task(writeMemo)({ risks, parties })
      })
    `)
    expect(compiled.ok, compiled.ok ? "" : compiled.errors.join("; ")).toBe(true)
    if (!compiled.ok) return
    expect(compiled.program.modules.map((m) => m.kind)).toEqual(["input", "fork", "llm", "output"])
  })

  it("turns two workflow args (parse first, keep second raw) into combine", () => {
    const compiled = compileSpineJs(`
      const Flag = model("ComplianceFlag", { ok: z.boolean() })
      async function audit(input) {
        return generateObject({ schema: Flag, prompt: "Audit the expense against policy.", note: "One audit llm after combine." })
      }
      export const main = workflow(async (policy, expenseReport) => {
        const policyRows = await step("Parse Policy Table", () => policy.content.split("\\n").map((line, i) => ({ row_id: String(i + 1), cells_json: line })))
        return await task(audit)({ policyRows, expenseReport })
      })
    `)
    expect(compiled.ok, compiled.ok ? "" : compiled.errors.join("; ")).toBe(true)
    if (!compiled.ok) return
    expect(compiled.program.modules.map((m) => m.kind)).toContain("combine")
  })

  it("turns two parsed workflow args into assemble", () => {
    const compiled = compileSpineJs(`
      const Resume = model("Resume", { name: z.string() })
      const JobDescription = model("JobDescription", { required_skills: z.array(z.string()) })
      async function extractResume(doc) {
        return generateObject({ schema: Resume, prompt: "Extract name.", note: "One Resume per file." })
      }
      async function parseJob(doc) {
        return generateObject({ schema: JobDescription, prompt: "List required skills.", note: "Parse the job." })
      }
      export const main = workflow(async (resumes, jobDoc) => {
        const parsed = []
        for (const file of resumes) parsed.push(await task(extractResume)(file))
        const job = await task(parseJob)(jobDoc)
        return { resumes: parsed, job_desc: job }
      })
    `)
    expect(compiled.ok, compiled.ok ? "" : compiled.errors.join("; ")).toBe(true)
    if (!compiled.ok) return
    expect(compiled.program.modules.map((m) => m.kind)).toContain("assemble")
  })

  it("turns flatMap after a batch into custom-code flatten", () => {
    const compiled = compileSpineJs(`
      const ActionItem = model("ActionItem", { task: z.string(), owner: z.string() })
      const NoteItems = model("NoteItems", { items: z.array(ActionItem) })
      async function extractItems(doc) {
        return generateObject({ schema: NoteItems, prompt: "Extract every action item.", note: "One NoteItems wrapper per file." })
      }
      export const main = workflow(async (files) => {
        const notes = []
        for (const file of files) notes.push(await task(extractItems)(file))
        return notes.flatMap(n => n.items)
      })
    `)
    expect(compiled.ok, compiled.ok ? "" : compiled.errors.join("; ")).toBe(true)
    if (!compiled.ok) return
    expect(compiled.program.modules.map((m) => m.kind)).toEqual(["input", "llm-batch", "custom-code", "output"])
  })

  it("feeds TypeScript compile errors back instead of emitting JSON", () => {
    const compiled = compileSpineJs(`export const main = workflow(async (files) => { return files.`)
    expect(compiled.ok).toBe(false)
    if (compiled.ok) return
    expect(compiled.errors.join(" ")).toMatch(/compile|error|Unexpected|expected/i)
  })

  it("compiles a passthrough but semantic check rejects it as empty work", () => {
    const compiled = compileSpineJs(`export const main = workflow(async (files) => { return files })`)
    expect(compiled.ok, compiled.ok ? "" : compiled.errors.join("; ")).toBe(true)
    if (!compiled.ok) return
    const errors = semanticCheckProgram({ program: compiled.program, docs: [] })
    expect(errors.join(" ")).toMatch(/empty|two test files/i)
  })

  it("writes a typed run() contract without the graph", () => {
    const compiled = compileSpineJs(receiptWorkflow)
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const dts = programToContractDts(compiled.program)
    expect(dts).toContain("export declare function run")
    expect(dts).toContain("ReceiptRow")
    expect(dts).not.toContain("llm-batch")
  })

  it("rejects a single identical test doc as a weak success signal", () => {
    const compiled = compileSpineJs(receiptWorkflow)
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const errors = semanticCheckProgram({
      program: compiled.program,
      docs: [{ name: "a.txt", content: "same" }, { name: "b.txt", content: "same" }],
    })
    expect(errors.join(" ")).toMatch(/two test files/i)
  })
})
