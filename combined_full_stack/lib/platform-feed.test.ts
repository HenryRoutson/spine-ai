import { describe, expect, it } from "vitest"
import { feedableInputsForModel } from "@/lib/platform-feed"
import { FieldType, InputType, ModuleKind, type ModuleId, type PipelineModule, type StructureModel, type StructureModelId } from "@/lib/types"

const modelId = "m_lead" as StructureModelId
const model: StructureModel = {
  id: modelId,
  name: "Lead",
  description: "A row",
  fields: [{ id: "f_name", name: "name", type: FieldType.Text, optional: false, description: "Name" }],
}

describe("feedable inputs", () => {
  it("offers JSON inputs whose structure matches the model", () => {
    const modules: PipelineModule[] = [
      {
        id: "mod_json" as ModuleId,
        kind: ModuleKind.Input,
        label: "Lead JSON",
        note: "",
        inputType: InputType.Json,
        outStructureId: modelId,
        cached: true,
        avgMs: 1,
        avgCostCents: 0,
      },
      {
        id: "mod_pdf" as ModuleId,
        kind: ModuleKind.Input,
        label: "PDF",
        note: "",
        inputType: InputType.Pdf,
        cached: true,
        avgMs: 1,
        avgCostCents: 0,
      },
    ]
    const hits = feedableInputsForModel(modules, [model], [], modelId)
    expect(hits).toEqual([
      expect.objectContaining({ moduleId: "mod_json", label: "Lead JSON", inputType: InputType.Json, status: "exact" }),
    ])
  })
})
