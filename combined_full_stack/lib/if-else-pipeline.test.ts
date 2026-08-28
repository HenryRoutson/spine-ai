import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { computeInvalid } from "@/lib/validity"
import { flattenPipelineModules, isNestedLaneKind, deriveIfElseStepTypes } from "@/lib/fork-pipeline"
import { loadProjectSeed, SEEDS_DIR } from "@/lib/server/seed"
import { formatModuleSpineOut } from "@/lib/spine-type"
import { derivePipelineMermaid } from "@/lib/pipeline-mermaid"
import {
  defaultIfElseBranches,
  evalIfCondition,
  formatIfCondition,
  joinIfElseValue,
  padIfElseBranches,
} from "@/lib/if-else-pipeline"
import { parseUserAddableKind } from "@/lib/module-kinds"
import { syncListOpsModules } from "@/lib/list-ops-steps"
import { addPipelineStep } from "@/lib/cli/workspace_edits"
import { createPipelineModule } from "@/lib/pipeline-module-factory"
import { FieldType, IfConditionKind, ModuleKind, type ModuleId, type PipelineModule, type StructureModel, type StructureModelId } from "@/lib/types"
import { ifConditionSchema } from "@/lib/if-condition"
import { TypeExprKind, type TypeExpr } from "@/lib/server/type_expr"
import { segmentPipeline } from "@/lib/pipeline-layout"

function step(partial: Omit<Partial<PipelineModule>, "id"> & { id: string; kind: PipelineModule["kind"]; label: string }): PipelineModule {
  return {
    note: "",
    cached: true,
    avgMs: 0,
    avgCostCents: 0,
    ...partial,
    id: partial.id as ModuleId,
  }
}

const routeModel: StructureModel = {
  id: "m_route" as StructureModelId,
  name: "Route",
  description: "",
  fields: [
    { id: "f_ok", name: "is_legal", type: FieldType.Bool, optional: false, description: "" },
    { id: "f_kind", name: "kind", type: FieldType.Text, optional: false, description: "" },
    { id: "f_score", name: "score", type: FieldType.Int, optional: false, description: "" },
  ],
}

describe("if/else step", () => {
  it("is a user-addable kind with aliases", () => {
    expect(parseUserAddableKind("if-else")).toBe("if-else")
    expect(parseUserAddableKind("ifelse")).toBe("if-else")
    expect(parseUserAddableKind("if")).toBe("if-else")
    expect(parseUserAddableKind("router")).toBe("if-else")
  })

  it("pads Then + Else lanes", () => {
    const padded = padIfElseBranches()
    expect(padded).toHaveLength(2)
    expect(padded[0]?.label).toBe("Then")
    expect(padded[1]?.label).toBe("Else")
    expect(defaultIfElseBranches()).toHaveLength(2)
  })

  it("evaluates a bool spine path", () => {
    expect(evalIfCondition({ kind: IfConditionKind.Path, path: "is_legal" }, { is_legal: true })).toBe(true)
    expect(evalIfCondition({ kind: IfConditionKind.Path, path: "is_legal" }, { is_legal: false })).toBe(false)
    expect(formatIfCondition({ kind: IfConditionKind.Path, path: "is_legal" })).toBe("is_legal")
  })

  it("coerces legacy comparison kinds to a bool path in the persist schema", () => {
    expect(ifConditionSchema.safeParse({ kind: "gt", path: "score", value: 80 }).success).toBe(true)
    expect(ifConditionSchema.safeParse({ kind: "equals", path: "kind" }).data).toEqual({ kind: IfConditionKind.Path, path: "kind" })
  })

  it("joins the chosen lane or passthrough", () => {
    const m = step({
      id: "ife",
      kind: ModuleKind.IfElse,
      label: "Route",
      ifCondition: { kind: IfConditionKind.Path, path: "is_legal" },
      forkBranches: [
        { id: "t", label: "Then", modules: [step({ id: "t1", kind: ModuleKind.Output, label: "LegalOut" })] },
        { id: "e", label: "Else", modules: [] },
      ],
    })
    expect(joinIfElseValue(m, { is_legal: true }, { LegalOut: { ok: 1 } })).toEqual({ ok: 1 })
    expect(joinIfElseValue(m, { is_legal: false }, { LegalOut: { ok: 1 } })).toEqual({ is_legal: false })
  })

  it("flattens nested Then steps and segments as a fork box", () => {
    const inner = step({
      id: "ife",
      kind: ModuleKind.IfElse,
      label: "Route",
      ifCondition: { kind: IfConditionKind.Path, path: "is_legal" },
      forkBranches: [
        { id: "t", label: "Then", modules: [step({ id: "t1", kind: ModuleKind.N8n, label: "Legal" })] },
        { id: "e", label: "Else", modules: [step({ id: "e1", kind: ModuleKind.N8n, label: "Billing" })] },
      ],
    })
    expect(isNestedLaneKind(inner.kind)).toBe(true)
    expect(flattenPipelineModules([inner]).map((m) => m.id)).toEqual(["ife", "t1", "e1"])
    const segs = segmentPipeline([
      step({ id: "in", kind: ModuleKind.Input, label: "In", outStructureId: "m_route" as StructureModelId }),
      inner,
    ])
    expect(segs.map((s) => s.kind)).toEqual(["step", "fork"])
  })

  it("unions Then/Else out types when they differ", () => {
    const thenType: TypeExpr = { kind: TypeExprKind.Ref, modelId: "m_legal" as StructureModelId }
    const elseType: TypeExpr = { kind: TypeExprKind.Ref, modelId: "m_bill" as StructureModelId }
    const m = step({
      id: "ife",
      kind: ModuleKind.IfElse,
      label: "Route",
      forkBranches: [
        {
          id: "t",
          label: "Then",
          modules: [step({ id: "t1", kind: ModuleKind.Output, label: "Legal", outType: thenType, outStructureId: "m_legal" as StructureModelId })],
        },
        {
          id: "e",
          label: "Else",
          modules: [step({ id: "e1", kind: ModuleKind.Output, label: "Bill", outType: elseType, outStructureId: "m_bill" as StructureModelId })],
        },
      ],
    })
    const prev = step({
      id: "in",
      kind: ModuleKind.Input,
      label: "In",
      outType: { kind: TypeExprKind.Ref, modelId: "m_route" as StructureModelId },
      outStructureId: "m_route" as StructureModelId,
    })
    const derived = deriveIfElseStepTypes(m, prev, [])
    expect(derived.module.outType).toEqual({ kind: TypeExprKind.Union, variants: [thenType, elseType] })
  })

  it("factory defaults condition + two lanes", () => {
    const m = createPipelineModule({ kind: ModuleKind.IfElse, note: "route" }, [routeModel], "deepseek-v4")
    expect(m.kind).toBe(ModuleKind.IfElse)
    expect(m.forkBranches).toHaveLength(2)
    expect(m.ifCondition).toEqual({ kind: IfConditionKind.Path, path: "" })
  })

  it("validity requires a bool condition path and a Then step", () => {
    const prev = step({
      id: "in",
      kind: ModuleKind.Input,
      label: "In",
      note: "input",
      outStructureId: "m_route" as StructureModelId,
      outType: { kind: TypeExprKind.Ref, modelId: "m_route" as StructureModelId },
    })
    const empty = createPipelineModule({ kind: ModuleKind.IfElse, note: "route" }, [routeModel], "deepseek-v4")
    empty.id = "ife" as ModuleId
    const invalid = computeInvalid([prev, empty], [routeModel])
    const msgs = [...invalid.values()].flat().map((i) => ("structureMessage" in i ? i.structureMessage : i.kind))
    expect(msgs.join(" ")).toMatch(/Then lane is empty|condition path/)
  })

  it("allows empty Else when Then has a step and the path is bool", () => {
    const prev = step({
      id: "in",
      kind: ModuleKind.Input,
      label: "In",
      note: "input",
      outStructureId: "m_route" as StructureModelId,
      outType: { kind: TypeExprKind.Ref, modelId: "m_route" as StructureModelId },
    })
    const route = createPipelineModule({ kind: ModuleKind.IfElse, note: "route" }, [routeModel], "deepseek-v4")
    route.id = "ife" as ModuleId
    route.ifCondition = { kind: IfConditionKind.Path, path: "is_legal" }
    route.forkBranches = [
      { id: "t", label: "Then", modules: [step({ id: "t1", kind: ModuleKind.Output, label: "LegalOut", note: "", inStructureId: "m_route" as StructureModelId, outStructureId: "m_route" as StructureModelId })] },
      { id: "e", label: "Else", modules: [] },
    ]
    const invalid = computeInvalid([prev, route], [routeModel])
    const msgs = [...invalid.values()].flat().map((i) => ("structureMessage" in i ? i.structureMessage : i.kind))
    expect(msgs.join(" ")).not.toMatch(/Then lane is empty/)
    expect(msgs.join(" ")).not.toMatch(/Else/)
  })

  it("type-checks the condition path as bool — comparisons belong in custom-code", () => {
    const prev = step({
      id: "in",
      kind: ModuleKind.Input,
      label: "In",
      note: "input",
      outStructureId: "m_route" as StructureModelId,
      outType: { kind: TypeExprKind.Ref, modelId: "m_route" as StructureModelId },
    })
    const ok = createPipelineModule({ kind: ModuleKind.IfElse, note: "route" }, [routeModel], "deepseek-v4")
    ok.id = "ife" as ModuleId
    ok.ifCondition = { kind: IfConditionKind.Path, path: "is_legal" }
    ok.forkBranches = [
      { id: "t", label: "Then", modules: [step({ id: "t1", kind: ModuleKind.Output, label: "High", note: "", inStructureId: "m_route" as StructureModelId, outStructureId: "m_route" as StructureModelId })] },
      { id: "e", label: "Else", modules: [] },
    ]
    const okMsgs = [...computeInvalid([prev, ok], [routeModel]).values()].flat().map((i) => ("structureMessage" in i ? i.structureMessage : i.kind))
    expect(okMsgs.join(" ")).not.toMatch(/must be bool/)

    const bad = { ...ok, ifCondition: { kind: IfConditionKind.Path, path: "score" } }
    const badMsgs = [...computeInvalid([prev, bad], [routeModel]).values()].flat().map((i) => ("structureMessage" in i ? i.structureMessage : i.kind))
    expect(badMsgs.join(" ")).toMatch(/must be bool/)
  })

  it("syncs list-ops inside Then", () => {
    const chunk = step({ id: "t1", kind: ModuleKind.Chunk, label: "Split" })
    const inner = step({
      id: "ife",
      kind: ModuleKind.IfElse,
      label: "Route",
      forkBranches: [
        { id: "t", label: "Then", modules: [chunk] },
        { id: "e", label: "Else", modules: [] },
      ],
    })
    const synced = syncListOpsModules([inner], [routeModel])
    const thenStep = synced.modules[0]?.forkBranches?.[0]?.modules[0]
    expect(thenStep?.fallbackList?.[0]?.typescript).toContain("SIZE")
  })

  it("inserts into Then by lane label", () => {
    const inner = createPipelineModule({ kind: ModuleKind.IfElse, note: "route" }, [routeModel], "deepseek-v4")
    inner.id = "ife" as ModuleId
    const holder: { modules: PipelineModule[] } = {
      modules: [
        step({
          id: "in",
          kind: ModuleKind.Input,
          label: "In",
          outStructureId: "m_route" as StructureModelId,
        }),
        inner,
      ],
    }
    const session = {
      models: [routeModel],
      model: "deepseek-v4" as const,
      get modules() {
        return holder.modules
      },
      setModules(next: PipelineModule[]) {
        holder.modules = next
      },
    }
    addPipelineStep(session as Parameters<typeof addPipelineStep>[0], ModuleKind.Transform, "LegalThen", {
      forkId: inner.id,
      branchId: "Then",
    })
    expect(holder.modules.find((m) => m.kind === ModuleKind.IfElse)?.forkBranches?.[0]?.modules[0]?.label).toBe("LegalThen")
  })

  it("Urgent Ticket Route seed unions Then PagerAlert with Else QueueTicket", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "urgent_ticket.json"))
    const route = project.modules.find((m) => m.kind === ModuleKind.IfElse)
    expect(route?.ifCondition).toEqual({ kind: IfConditionKind.Path, path: "urgent" })
    expect(formatModuleSpineOut(route!, project.models)).toBe("PagerAlert | QueueTicket")
    const thenOut = route?.forkBranches?.[0]?.modules[0]
    const elseOut = route?.forkBranches?.[1]?.modules[0]
    expect(formatModuleSpineOut(thenOut!, project.models)).toBe("PagerAlert")
    expect(formatModuleSpineOut(elseOut!, project.models)).toBe("QueueTicket")
    const chart = derivePipelineMermaid(project.modules, project.models)
    expect(chart).toContain("Then")
    expect(chart).toContain("Else")
  })
})
