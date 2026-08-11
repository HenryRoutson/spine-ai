import { describe, expect, it } from "vitest"
import {
  deriveAssembleStepTypes,
  typeExprAssignable,
  validateAssembleBindings,
} from "@/lib/assemble-type-expr"
import { FieldType, ModuleKind, type ModuleId, type PipelineModule, type StructureModel, type StructureModelId } from "@/lib/types"

const mSummary = "m_summary" as StructureModelId
const mEntities = "m_entities" as StructureModelId

const models: StructureModel[] = [
  {
    id: mSummary,
    name: "Summary",
    description: "",
    fields: [{ id: "f1", name: "text", type: FieldType.Text, optional: false, description: "" }],
  },
  {
    id: mEntities,
    name: "Entities",
    description: "",
    fields: [{ id: "f2", name: "items", type: FieldType.ListText, optional: false, description: "" }],
  },
]

function mod(partial: Partial<PipelineModule> & Pick<PipelineModule, "id" | "kind" | "label">): PipelineModule {
  return {
    note: "",
    cached: true,
    avgMs: 0,
    avgCostCents: 0,
    ...partial,
  }
}

describe("typeExprAssignable", () => {
  it("accepts equal refs and optional widening", () => {
    expect(
      typeExprAssignable({ kind: "ref", modelId: mSummary }, { kind: "ref", modelId: mSummary }),
    ).toBe(true)
    expect(
      typeExprAssignable(
        { kind: "optional", inner: { kind: "ref", modelId: mSummary } },
        { kind: "ref", modelId: mSummary },
      ),
    ).toBe(true)
    expect(
      typeExprAssignable({ kind: "ref", modelId: mSummary }, { kind: "ref", modelId: mEntities }),
    ).toBe(false)
  })
})

describe("deriveAssembleStepTypes", () => {
  it("derives auto out model from bindings", () => {
    const llmA = mod({
      id: "mod_a" as ModuleId,
      kind: ModuleKind.Llm,
      label: "Summarize",
      outStructureId: mSummary,
      outType: { kind: "ref", modelId: mSummary },
    })
    const llmB = mod({
      id: "mod_b" as ModuleId,
      kind: ModuleKind.Llm,
      label: "Extract",
      inStructureId: mSummary,
      outStructureId: mEntities,
      outType: { kind: "ref", modelId: mEntities },
    })
    const assemble = mod({
      id: "mod_zip" as ModuleId,
      kind: ModuleKind.Assemble,
      label: "Assemble",
      note: "zip",
      assembleBindings: {
        summary: { kind: "state", label: "Summarize" },
        entities: { kind: "spine" },
      },
    })
    const modules = [llmA, llmB, assemble]
    const { module, models: next } = deriveAssembleStepTypes(assemble, llmB, modules, 2, models)
    expect(module.outStructureId).toBe(`sm_assemble_${assemble.id}`)
    const out = next.find((m) => m.id === module.outStructureId)
    expect(out?.auto).toBe(true)
    expect(out?.fields.map((f) => f.name).sort()).toEqual(["entities", "summary"])
  })
})

describe("validateAssembleBindings", () => {
  it("requires spine and flags nested assemble", () => {
    const a = mod({
      id: "mod_a" as ModuleId,
      kind: ModuleKind.Llm,
      label: "A",
      outStructureId: mSummary,
      outType: { kind: "ref", modelId: mSummary },
    })
    const zip1 = mod({
      id: "mod_z1" as ModuleId,
      kind: ModuleKind.Assemble,
      label: "Zip1",
      note: "z",
      outStructureId: mSummary,
      assembleBindings: { x: { kind: "spine" } },
    })
    const zip2 = mod({
      id: "mod_z2" as ModuleId,
      kind: ModuleKind.Assemble,
      label: "Zip2",
      note: "z",
      outStructureId: mSummary,
      assembleBindings: {
        a: { kind: "state", label: "Zip1" },
        b: { kind: "state", label: "A" },
      },
    })
    const modules = [a, zip1, zip2]
    const issues = validateAssembleBindings(zip2, zip1, modules, 2, models)
    expect(issues.some((i) => i.message.includes("spine"))).toBe(true)
    expect(issues.some((i) => i.message.includes("prefer original"))).toBe(true)
  })
})
