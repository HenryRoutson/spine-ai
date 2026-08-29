import { describe, expect, it } from "vitest"
import { resolve } from "node:path"
import { computeInvalid } from "@/lib/validity"
import { insertPipelineModules, isControlJoinKind } from "@/lib/fork-pipeline"
import { pickCaseBranch } from "@/lib/case-pipeline"
import { exclusiveContinues, pickExclusiveBranch, skippedExclusiveModules } from "@/lib/exclusive-control"
import { parseUserAddableKind } from "@/lib/module-kinds"
import { createPipelineModule } from "@/lib/pipeline-module-factory"
import { loadProjectSeed, SEEDS_DIR } from "@/lib/server/seed"
import { formatModuleSpineOut } from "@/lib/spine-type"
import { computeWarnings } from "@/lib/validity"
import { FieldType, IfConditionKind, ModuleKind, type ModuleId, type PipelineModule, type StructureModel, type StructureModelId } from "@/lib/types"

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

const ticket: StructureModel = {
  id: "m_ticket" as StructureModelId,
  name: "Ticket",
  description: "",
  fields: [
    { id: "f_status", name: "status", type: FieldType.Text, optional: false, description: "" },
    { id: "f_ok", name: "urgent", type: FieldType.Bool, optional: false, description: "" },
  ],
}

describe("case + optional Join", () => {
  it("is user-addable with switch/match aliases", () => {
    expect(parseUserAddableKind("case")).toBe("case")
    expect(parseUserAddableKind("switch")).toBe("case")
    expect(parseUserAddableKind("join")).toBe("control-join")
  })

  it("picks the matching arm or the default", () => {
    const m = step({
      id: "cse",
      kind: ModuleKind.Case,
      label: "Route",
      ifCondition: { kind: IfConditionKind.Path, path: "status" },
      forkBranches: [
        { id: "a", label: "Legal", match: "legal", modules: [step({ id: "a1", kind: ModuleKind.Output, label: "LegalOut" })] },
        { id: "b", label: "Default", match: "_", modules: [step({ id: "b1", kind: ModuleKind.Output, label: "OtherOut" })] },
      ],
    })
    expect(pickCaseBranch(m, { status: "legal" })?.id).toBe("a")
    expect(pickCaseBranch(m, { status: "other" })?.id).toBe("b")
    expect(pickExclusiveBranch(m, { status: "legal" })?.label).toBe("Legal")
  })

  it("records skipped modules on the untaken arms", () => {
    const m = step({
      id: "cse",
      kind: ModuleKind.Case,
      label: "Route",
      ifCondition: { kind: IfConditionKind.Path, path: "status" },
      forkBranches: [
        { id: "a", label: "Legal", match: "legal", modules: [step({ id: "a1", kind: ModuleKind.Output, label: "LegalOut" })] },
        { id: "b", label: "Default", match: "_", modules: [step({ id: "b1", kind: ModuleKind.Output, label: "OtherOut" })] },
      ],
    })
    const taken = pickCaseBranch(m, { status: "legal" })
    expect(skippedExclusiveModules(m, taken).map((x) => x.id)).toEqual(["b1"])
  })

  it("continues the spine only when Join follows", () => {
    const cse = step({
      id: "cse",
      kind: ModuleKind.Case,
      label: "Route",
      ifCondition: { kind: IfConditionKind.Path, path: "status" },
      forkBranches: [
        { id: "a", label: "Legal", match: "legal", modules: [step({ id: "a1", kind: ModuleKind.Output, label: "LegalOut" })] },
        { id: "b", label: "Default", match: "_", modules: [] },
      ],
    })
    expect(exclusiveContinues([cse], 0)).toBe(false)
    expect(exclusiveContinues([cse, step({ id: "join", kind: ModuleKind.ControlJoin, label: "Join", note: "go" })], 0)).toBe(true)
  })

  it("flags steps after if/case unless Join sits there", () => {
    const prev = step({
      id: "in",
      kind: ModuleKind.Input,
      label: "In",
      note: "input",
      outStructureId: "m_ticket" as StructureModelId,
    })
    const cse = createPipelineModule({ kind: ModuleKind.Case, note: "route" }, [ticket], "deepseek-v4")
    cse.id = "cse" as ModuleId
    cse.ifCondition = { kind: IfConditionKind.Path, path: "status" }
    cse.forkBranches = [
      { id: "a", label: "Legal", match: "legal", modules: [step({ id: "a1", kind: ModuleKind.Output, label: "LegalOut", note: "", inStructureId: "m_ticket" as StructureModelId, outStructureId: "m_ticket" as StructureModelId })] },
      { id: "b", label: "Default", match: "_", modules: [] },
    ]
    const later = step({ id: "out", kind: ModuleKind.Output, label: "Out", note: "", inStructureId: "m_ticket" as StructureModelId, outStructureId: "m_ticket" as StructureModelId })
    const bad = [...computeInvalid([prev, cse, later], [ticket]).values()].flat().map((i) => ("structureMessage" in i ? i.structureMessage : i.kind))
    expect(bad.join(" ")).toMatch(/Join/)
    const join = step({ id: "join", kind: ModuleKind.ControlJoin, label: "Join", note: "continue" })
    const ok = [...computeInvalid([prev, cse, join, later], [ticket]).values()].flat().map((i) => ("structureMessage" in i ? i.structureMessage : i.kind))
    expect(ok.join(" ")).not.toMatch(/steps after if\/case/)
  })

  it("inserts Join when adding a spine step after exclusive", () => {
    const cse = step({
      id: "cse",
      kind: ModuleKind.Case,
      label: "Route",
      ifCondition: { kind: IfConditionKind.Path, path: "status" },
      forkBranches: [
        { id: "a", label: "Legal", match: "legal", modules: [step({ id: "a1", kind: ModuleKind.Output, label: "LegalOut" })] },
        { id: "b", label: "Default", match: "_", modules: [] },
      ],
    })
    const next = insertPipelineModules(
      [cse],
      1,
      [step({ id: "out", kind: ModuleKind.Output, label: "Out" })],
    )
    expect(isControlJoinKind(next[1]?.kind ?? "")).toBe(true)
    expect(next[2]?.id).toBe("out")
  })

  it("Status Case Route seed unions three arm types without Join", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "status_route.json"))
    const route = project.modules.find((m) => m.kind === ModuleKind.Case)
    expect(route?.ifCondition).toEqual({ kind: IfConditionKind.Path, path: "status" })
    expect(formatModuleSpineOut(route!, project.models)).toBe("LegalRoute | BillingRoute | GeneralRoute")
    expect(project.modules.some((m) => m.kind === ModuleKind.ControlJoin)).toBe(false)
    expect([...computeInvalid(project.modules, project.models).values()].flat()).toHaveLength(0)
    expect([...computeWarnings(project.modules, project.models).values()].flat().map((w) => w.detail).join(" ")).not.toMatch(/never used/)
  })
})
