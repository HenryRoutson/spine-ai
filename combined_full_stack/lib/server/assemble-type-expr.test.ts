import { describe, expect, it } from "vitest"
import {
  deriveAssembleStepTypes,
  resolveAssembleSourceType,
  typeExprAssignable,
  validateAssembleBindings,
} from "@/lib/assemble-type-expr"
import {
  expandTypeExprFull,
  substituteTypeParams,
  typeExprAtPath,
} from "@/lib/type-expr-polymorph"
import {
  FieldType,
  ModuleKind,
  type ModuleId,
  type PipelineModule,
  type StructureModel,
  type StructureModelId,
  type TypeAlias,
  type TypeAliasId,
} from "@/lib/types"

const mSummary = "m_summary" as StructureModelId
const mEntities = "m_entities" as StructureModelId
const mReport = "m_report" as StructureModelId

const models: StructureModel[] = [
  {
    id: mSummary,
    name: "Summary",
    description: "",
    fields: [
      { id: "f1", name: "text", type: FieldType.Text, optional: false, description: "" },
      { id: "f_meta", name: "meta", type: FieldType.Text, optional: false, description: "" },
    ],
  },
  {
    id: mEntities,
    name: "Entities",
    description: "",
    fields: [{ id: "f2", name: "items", type: FieldType.ListText, optional: false, description: "" }],
  },
  {
    id: mReport,
    name: "Report",
    description: "",
    params: ["T"],
    fields: [
      {
        id: "f_body",
        name: "body",
        type: FieldType.Json,
        optional: false,
        description: "",
        typeExpr: { kind: "named", name: "T" },
      },
    ],
  },
]

const aliases: TypeAlias[] = [
  {
    id: "ta_pair" as TypeAliasId,
    name: "Pair",
    description: "",
    params: ["A", "B"],
    expr: {
      kind: "generic",
      name: "__pair",
      args: [
        { kind: "generic", name: "left", args: [{ kind: "named", name: "A" }] },
        { kind: "generic", name: "right", args: [{ kind: "named", name: "B" }] },
      ],
    },
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
  it("list covariance and union membership", () => {
    expect(
      typeExprAssignable(
        { kind: "list", item: { kind: "ref", modelId: mSummary } },
        { kind: "list", item: { kind: "ref", modelId: mSummary } },
        [],
        models,
      ),
    ).toBe(true)
    expect(
      typeExprAssignable(
        {
          kind: "union",
          variants: [
            { kind: "ref", modelId: mSummary },
            { kind: "ref", modelId: mEntities },
          ],
        },
        { kind: "ref", modelId: mSummary },
        [],
        models,
      ),
    ).toBe(true)
  })
})

describe("parametric aliases and structs", () => {
  it("substitutes TypeAlias params", () => {
    const expanded = expandTypeExprFull(
      {
        kind: "generic",
        name: "Pair",
        args: [
          { kind: "ref", modelId: mSummary },
          { kind: "ref", modelId: mEntities },
        ],
      },
      models,
      aliases,
    )
    expect(expanded.kind).toBe("generic")
  })

  it("substitutes StructureModel params via Ref args", () => {
    const sub = substituteTypeParams(
      { kind: "named", name: "T" },
      { T: { kind: "ref", modelId: mSummary } },
    )
    expect(sub).toEqual({ kind: "ref", modelId: mSummary })
  })
})

describe("path sources", () => {
  it("resolves field path types", () => {
    const root = { kind: "ref" as const, modelId: mSummary }
    expect(typeExprAtPath(root, "text", models)).toEqual({ kind: "prim", name: "text" })
  })

  it("validates path bindings", () => {
    const llm = mod({
      id: "mod_a" as ModuleId,
      kind: ModuleKind.Llm,
      label: "Summarize",
      outStructureId: mSummary,
      outType: { kind: "ref", modelId: mSummary },
    })
    const assemble = mod({
      id: "mod_zip" as ModuleId,
      kind: ModuleKind.Assemble,
      label: "Assemble",
      note: "zip",
      assembleBindings: {
        title: { kind: "path", from: "spine", path: "text" },
      },
      outStructureId: mSummary,
    })
    // AI : out Summary requires text+meta — expect missing meta + type mismatch on title vs text field name on out
    const issues = validateAssembleBindings(assemble, llm, [llm, assemble], 1, models)
    expect(issues.some((i) => i.message.includes("meta") || i.message.includes("binding"))).toBe(true)
    const t = resolveAssembleSourceType(
      { kind: "path", from: "spine", path: "text" },
      llm,
      [llm, assemble],
      1,
      models,
    )
    expect(t).toEqual({ kind: "prim", name: "text" })
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
