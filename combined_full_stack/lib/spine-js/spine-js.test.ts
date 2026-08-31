import { describe, expect, it } from "vitest"
import { compileSpineJs } from "@/lib/spine-js/compile"
import { payloadToSpineJs } from "@/lib/spine-js/payload-to-js"
import { mermaidFromProgram, cachePlan, stepOutputs } from "@/lib/spine-js/runtime"
import { vibeExampleTasks } from "@/lib/server/vibe-coding-examples"
import { moduleSpecSchema } from "@/lib/server/pipeline-authoring-schema"
import { createSpineSession } from "@/lib/core/session"
import { materializeProposal } from "@/lib/server/pipeline_assistant"
import { formatPipelineValidationErrors } from "@/lib/server/validity"
import { DEFAULT_MODEL } from "@/lib/types"

const receiptJs = `
const ReceiptRow = model("ReceiptRow", {
  date: z.string().describe("Receipt date"),
  vendor: z.string().describe("Vendor name"),
  amount: z.number().describe("Total amount"),
})

export const message = "I'll add a receipt extractor."
export const docs = [{ name: "receipt_coffee.txt", type: "text", content: "COFFEE SHOP" }]
export const projectName = "Receipt to Spreadsheet"

export default pipeline(
  input({
    label: "Receipt Uploads",
    note: "Many receipt files uploaded into one slot.",
    schema: z.array(Document),
    type: "text",
    inputMinCount: 2,
  }),
  llmBatch({
    label: "Extract Each Receipt",
    note: "One structured ReceiptRow per uploaded Document.",
    schema: ReceiptRow,
    prompt: "Extract date, vendor, and total amount from this receipt text.",
  }),
  output({ schema: ReceiptRow })
)
`

describe("spine-js library", () => {
  it("compiles a receipt pipeline into JSON IR that passes moduleSpecSchema", () => {
    const compiled = compileSpineJs(receiptJs)
    expect(compiled.ok, compiled.ok ? "" : compiled.errors.join("; ")).toBe(true)
    if (!compiled.ok) return
    expect(compiled.program.modules.map((m) => m.kind)).toEqual(["input", "llm-batch", "output"])
    expect(compiled.program.modules[0]?.structureOut).toBe("list[Document]")
    expect(compiled.program.modules[1]?.structureIn).toBe("Document")
    expect(compiled.program.modules[1]?.structureOut).toBe("ReceiptRow")
    expect(compiled.program.models.some((m) => m.name === "ReceiptRow")).toBe(true)
    expect(compiled.program.models.some((m) => m.name === "Document")).toBe(false)
    for (const spec of compiled.program.modules) {
      const parsed = moduleSpecSchema.safeParse(spec)
      expect(parsed.success, parsed.success ? "" : parsed.error.toString()).toBe(true)
    }
  })

  it("enforces JSON restrictions: non-JSON input cannot emit a parsed model", () => {
    const compiled = compileSpineJs(`
      const Row = model("Row", { text: z.string() })
      export default pipeline(
        input({ schema: Row, type: "text", note: "files" }),
        output({ schema: Row })
      )
    `)
    expect(compiled.ok).toBe(false)
    if (compiled.ok) return
    expect(compiled.errors.join(" ")).toMatch(/Document/i)
  })

  it("llm-batch in: z.array(Document) unwraps to the item name (library, not JSON string)", () => {
    const compiled = compileSpineJs(`
      const Row = model("Row", { text: z.string() })
      export default pipeline(
        input({ schema: z.array(Document), type: "text", note: "files" }),
        llmBatch({ schema: Row, note: "extract", prompt: "go", in: z.array(Document) }),
        output({ schema: Row })
      )
    `)
    expect(compiled.ok, compiled.ok ? "" : compiled.errors.join("; ")).toBe(true)
    if (!compiled.ok) return
    expect(compiled.program.modules[1]?.structureIn).toBe("Document")
  })

  it("enforces JSON restrictions: fork needs two lanes", () => {
    const compiled = compileSpineJs(`
      const Risk = model("Risk", { text: z.string() })
      export default pipeline(
        input({ schema: Document, type: "text", note: "contract" }),
        fork({
          note: "lanes",
          branches: [
            { label: "Risks", steps: [llm({ schema: z.array(Risk), note: "risks", prompt: "extract" })] },
          ],
        }),
        output({ schema: Risk })
      )
    `)
    expect(compiled.ok).toBe(false)
    if (compiled.ok) return
    expect(compiled.errors.join(" ")).toMatch(/branches|2/i)
  })

  it("exports DAG mermaid, cache plan, and step traces from the library", () => {
    const compiled = compileSpineJs(receiptJs)
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const chart = mermaidFromProgram(compiled.program)
    expect(chart).toContain("flowchart LR")
    expect(chart).toContain("llm-batch")
    const cache = cachePlan(compiled.program)
    expect(cache.every((s) => s.cached)).toBe(true)
    const traces = stepOutputs(compiled.program)
    expect(traces.map((s) => s.kind)).toEqual(["input", "llm-batch", "output"])
  })

  it("compiles Windmill-shaped workflow() / task() into the same JSON IR", () => {
    const compiled = compileSpineJs(`
const ReceiptRow = model("ReceiptRow", {
  date: z.string().describe("Receipt date"),
  vendor: z.string().describe("Vendor name"),
  amount: z.number().describe("Total amount"),
})

async function extractEach() {
  return llmBatch({
    label: "Extract Each Receipt",
    note: "One structured ReceiptRow per uploaded Document.",
    schema: ReceiptRow,
    prompt: "Extract date, vendor, and total amount from this receipt text.",
  })
}

export const message = "I'll add a receipt extractor."
export const main = workflow(async () => {
  await input({
    label: "Receipt Uploads",
    note: "Many receipt files uploaded into one slot.",
    schema: z.array(Document),
    type: "text",
    inputMinCount: 2,
  })
  await task(extractEach)()
  await output({ schema: ReceiptRow })
})
`)
    expect(compiled.ok, compiled.ok ? "" : compiled.errors.join("; ")).toBe(true)
    if (!compiled.ok) return
    expect(compiled.program.modules.map((m) => m.kind)).toEqual(["input", "llm-batch", "output"])
    expect(compiled.program.modules[1]?.structureIn).toBe("Document")
  })

  it("preserves export const targetFunctionName on workflow()", () => {
    const compiled = compileSpineJs(`
export const targetFunctionName = "Hello Notes"
export const main = workflow(async () => {
  await input({ schema: z.array(Document), type: "text", note: "Paste notes." })
  await llmBatch({ schema: model("NoteSummary", { summary: z.string() }), note: "One summary per note.", prompt: "Summarize." })
  await output({ schema: model("NoteSummary", { summary: z.string() }) })
})
`)
    expect(compiled.ok, compiled.ok ? "" : compiled.errors.join("; ")).toBe(true)
    if (!compiled.ok) return
    expect(compiled.program.targetFunctionName).toBe("Hello Notes")
  })

  it("round-trips few-shot JSON payloads through JS and back to the same kinds", () => {
    for (const ex of vibeExampleTasks()) {
      const src = payloadToSpineJs(ex.payload)
      const compiled = compileSpineJs(src)
      expect(compiled.ok, `${ex.id}: ${compiled.ok ? "" : compiled.errors.join("; ")}`).toBe(true)
      if (!compiled.ok) continue
      const kinds = compiled.program.modules.map((m) => m.kind)
      const expected = (ex.payload.modules as Array<{ kind: string }>).map((m) => m.kind)
      expect(kinds, ex.id).toEqual(expected)
      const session = createSpineSession()
      session.addProject({ open: true })
      const proposal = materializeProposal(compiled.raw, session.project!, DEFAULT_MODEL)
      expect(proposal, ex.id).toBeTruthy()
      const errors = formatPipelineValidationErrors(
        proposal!.modules,
        proposal!.models,
        proposal!.typeAliases ?? [],
      )
      expect(errors.trim(), `${ex.id} ${errors}`).toBe("")
    }
  })
})
