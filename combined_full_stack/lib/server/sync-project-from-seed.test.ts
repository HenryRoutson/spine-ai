import { describe, expect, it } from "vitest"
import { FieldType, ModuleKind, InputType, type ModuleId, type Project, type ProjectId, type StructureModel, type StructureModelId } from "@/lib/types"
import { syncProjectFromSeed } from "@/lib/server/store"
import { SHARED_STRUCTURE_MODELS } from "@/lib/server/builtin_models"
import { isEmptyStarterPipeline } from "@/lib/workspace-validity-ui"
import { blankProject } from "@/lib/server/seed"

function model(name: string, id: string): StructureModel {
  return {
    id: id as StructureModelId,
    name,
    description: "",
    fields: [{ id: "f_1", name: "mood", type: FieldType.Text, optional: false, description: "" }],
  }
}

function seedLike(id: string, name: string): Project {
  return {
    id: id as ProjectId,
    name,
    kind: "template",
    models: [model("AuditRow", "m_seed")],
    modules: [
      {
        id: "mod_in" as ModuleId,
        kind: ModuleKind.Input,
        label: "Invoices",
        note: "",
        inputType: InputType.Text,
        cached: true,
        avgMs: 0,
        avgCostCents: 0,
      },
    ],
    strategies: [],
    seedDocNames: ["invoices.csv"],
  }
}

describe("syncProjectFromSeed", () => {
  it("does not reset a numbered clone's pipeline to the template", () => {
    const seed = seedLike("p_seed", "Audit Sample Tester")
    const clone: Project = {
      ...seedLike("p_clone", "Audit Sample Tester 1"),
      kind: "authored",
      models: [model("MoodVerdict", "m_mood")],
      modules: [
        {
          id: "mod_emails" as ModuleId,
          kind: ModuleKind.Input,
          label: "Customer Emails",
          note: "inbox dump",
          inputType: InputType.Text,
          cached: true,
          avgMs: 0,
          avgCostCents: 0,
        },
      ],
      seedDocNames: ["angry_email.txt"],
    }
    const next = syncProjectFromSeed(clone, seed)
    expect(next.models.map((m) => m.name)).toEqual(["MoodVerdict"])
    expect(next.modules.map((m) => m.label)).toEqual(["Customer Emails"])
    expect(next.seedDocNames).toEqual(["angry_email.txt"])
  })

  it("backfills seedDocNames on a clone that never stored them", () => {
    const seed = seedLike("p_seed", "Audit Sample Tester")
    const clone: Project = {
      ...seedLike("p_clone", "Audit Sample Tester 1"),
      seedDocNames: undefined,
    }
    const next = syncProjectFromSeed(clone, seed)
    expect(next.seedDocNames).toEqual(["invoices.csv"])
    expect(next.modules).toEqual(clone.modules)
  })
})

describe("isEmptyStarterPipeline", () => {
  it("treats a blank project as empty even after shared builtins are injected", () => {
    const blank = blankProject("p_blank" as ProjectId)
    expect(isEmptyStarterPipeline(blank.modules, blank.models)).toBe(true)
    expect(isEmptyStarterPipeline(blank.modules, [...SHARED_STRUCTURE_MODELS, ...blank.models])).toBe(
      true,
    )
  })
})
