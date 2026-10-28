import { describe, expect, it } from "vitest"
import { hostedSiteAppSummary, hostedSiteAppSummaryText } from "@/lib/hosted-site-app-summary"
import { InputType, ModuleKind, type Project, type ProjectId } from "@/lib/types"

function project(): Project {
  return {
    id: "p1" as ProjectId,
    name: "Receipt Extractor",
    kind: "blank",
    createdAt: 1,
    lastOpenedAt: 1,
    documentation: "SECRET internal rules — never send to the page agent",
    models: [],
    strategies: [],
    modules: [
      {
        id: "mod_in",
        kind: ModuleKind.Input,
        label: "Receipts",
        note: "Vendor PDFs",
        inputType: InputType.Pdf,
        inputNameContains: "receipt",
        prompt: "NEVER include this prompt",
        code: "NEVER include this code",
        cached: true,
        avgMs: 0,
        avgCostCents: 0,
      },
      {
        id: "mod_llm",
        kind: ModuleKind.Llm,
        label: "Extract",
        note: "Pull vendor and amount",
        prompt: "Extract vendor from {{content}}",
        cached: true,
        avgMs: 0,
        avgCostCents: 0,
      },
      {
        id: "mod_out",
        kind: ModuleKind.Output,
        label: "Rows",
        note: "",
        cached: true,
        avgMs: 0,
        avgCostCents: 0,
      },
    ],
  }
}

describe("hostedSiteAppSummary", () => {
  it("lists uploads and steps without prompts, code, or project docs", () => {
    const summary = hostedSiteAppSummary(project())
    expect(summary.name).toBe("Receipt Extractor")
    expect(summary.uploads).toEqual([
      { label: "Receipts", accepts: "PDF", note: "Vendor PDFs", filenameHint: "receipt" },
    ])
    expect(summary.outputs).toEqual(["Rows"])
    expect(summary.steps).toEqual(["Extract (llm)", "Rows (output)"])
    const text = hostedSiteAppSummaryText(project())
    expect(text).not.toContain("SECRET")
    expect(text).not.toContain("NEVER include")
    expect(text).not.toContain("{{content}}")
  })
})
