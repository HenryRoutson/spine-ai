import { describe, expect, it } from "vitest"
import { ModuleKind, type ModuleId, type StructureModelId } from "@/lib/types"
import { stepsUsingStructure } from "@/lib/structure-attachments"

describe("stepsUsingStructure", () => {
  it("lists steps that name the structure, not merely compatible ones", () => {
    const invoice = "m_inv" as StructureModelId
    const other = "m_other" as StructureModelId
    const modules = [
      {
        id: "mod_in" as ModuleId,
        kind: ModuleKind.Input,
        label: "App blueprint",
        note: "",
        cached: true,
        avgMs: 0,
        avgCostCents: 0,
        outStructureId: invoice,
      },
      {
        id: "mod_llm" as ModuleId,
        kind: ModuleKind.Llm,
        label: "Compile schema",
        note: "",
        cached: true,
        avgMs: 0,
        avgCostCents: 0,
        inStructureId: invoice,
        outStructureId: other,
      },
    ]
    const hits = stepsUsingStructure(modules, invoice)
    expect(hits.map((h) => h.label).sort()).toEqual(["App blueprint", "Compile schema"])
    expect(stepsUsingStructure(modules, other).map((h) => h.label)).toEqual(["Compile schema"])
  })
})
