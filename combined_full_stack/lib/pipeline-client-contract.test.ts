import { describe, expect, it } from "vitest"
import { pipelineClientContract, pipelineClientTypes } from "@/lib/pipeline-client-contract"
import { InputType, ModuleKind, FieldType, type Project, type ProjectId } from "@/lib/types"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"

function project(): Project {
  return {
    id: "p1" as ProjectId,
    name: "Receipt Extractor",
    kind: "blank",
    createdAt: 1,
    lastOpenedAt: 1,
    documentation: "SECRET internal rules",
    models: [
      {
        id: "m_row",
        name: "ReceiptRow",
        description: "One row",
        fields: [{ id: "f1", name: "vendor", type: FieldType.Text, optional: false, description: "Vendor" }],
      },
    ],
    strategies: [],
    modules: [
      {
        id: "mod_in",
        kind: ModuleKind.Input,
        label: "Receipts",
        inputType: InputType.Pdf,
        outStructureId: "m_row",
        cached: true,
        avgMs: 0,
        avgCostCents: 0,
      },
      {
        id: "mod_out",
        kind: ModuleKind.Output,
        label: "Rows",
        inStructureId: "m_row",
        outStructureId: "m_row",
        cached: true,
        avgMs: 0,
        avgCostCents: 0,
      },
    ],
  } as Project
}

describe("pipeline client contract", () => {
  it("emits OpenAPI + TypeScript without pipeline prompts or docs", () => {
    const contract = pipelineClientContract(project(), DEFAULT_HOSTED_SITE_OPTIONS)
    expect(JSON.stringify(contract.openapi)).toContain("/run/run")
    expect(contract.types).toContain("ReceiptRow")
    expect(contract.types).toContain("runPipeline")
    expect(contract.types).not.toContain("SECRET")
    expect(pipelineClientTypes(project())).toContain("SpineRunAlias")
  })
})
