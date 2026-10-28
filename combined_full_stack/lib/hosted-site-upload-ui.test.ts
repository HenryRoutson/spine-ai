import { describe, expect, it } from "vitest"
import { generateStepProgressHtml } from "@/lib/hosted-site-progress"
import {
  generateUploadFormHtml,
  injectUploadFormIntoRunSlot,
  uploadFieldsFromPipeline,
} from "@/lib/hosted-site-upload-ui"
import { InputType, ModuleKind, type ModuleId, type PipelineModule } from "@/lib/types"

const modules: PipelineModule[] = [
  {
    id: "mod_in" as ModuleId,
    kind: ModuleKind.Input,
    label: "Invoice PDF",
    note: "",
    inputType: InputType.Pdf,
    cached: true,
    avgMs: 1,
    avgCostCents: 0,
  },
  {
    id: "mod_json" as ModuleId,
    kind: ModuleKind.Input,
    label: "Meta JSON",
    note: "",
    inputType: InputType.Json,
    cached: true,
    avgMs: 1,
    avgCostCents: 0,
  },
  {
    id: "mod_out" as ModuleId,
    kind: ModuleKind.Output,
    label: "Result",
    note: "",
    cached: true,
    avgMs: 1,
    avgCostCents: 0,
  },
]

describe("hosted upload UI", () => {
  it("builds file fields from pipeline inputs", () => {
    const fields = uploadFieldsFromPipeline(modules)
    expect(fields.map((f) => f.label)).toEqual(["Invoice PDF", "Meta JSON"])
    expect(fields[0]?.accept).toContain(".pdf")
    expect(fields[1]?.accept).toContain(".json")
  })

  it("injects the form into an empty run slot", () => {
    const html = injectUploadFormIntoRunSlot(`<main><div class="hs-run-slot"></div></main>`, modules)
    expect(html).toContain("hs-upload-form")
    expect(html).toContain("Invoice PDF")
    expect(html).toContain("Run pipeline")
  })

  it("injects into a run slot that already has progress chrome", () => {
    const html = injectUploadFormIntoRunSlot(
      `<div class="hs-run-slot">\n${generateStepProgressHtml(modules)}\n</div>`,
      modules,
    )
    expect(html).toContain("hs-progress")
    expect(html).toContain("hs-upload-form")
    expect(html.match(/hs-run-slot/g)?.length).toBe(1)
  })
})

describe("hosted step progress", () => {
  it("lists visible pipeline steps", () => {
    const html = generateStepProgressHtml(modules)
    expect(html).toContain("Invoice PDF")
    expect(html).toContain("Meta JSON")
    expect(html).not.toContain("Result")
  })
})
