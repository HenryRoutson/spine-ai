import { describe, expect, it } from "vitest"
import { emptySessionSnapshot } from "@/lib/core/session"
import { deleteProjectSnapshot, patchProjectInList, projectPatchFromChanges, proposalGraphPatch, renamedProjects, withProjectDocumentation } from "@/lib/core/project-ops"
import { AUTHORED_PROJECT_KIND } from "@/lib/project-assistant-types"
import { FieldType, ModuleKind, type Project, type ProjectId, type StructureModel, type StructureModelId } from "@/lib/types"

const base = (id: string, name: string): Project => ({
  id: id as ProjectId,
  name,
  kind: "blank",
  createdAt: 1,
  lastOpenedAt: 1,
  models: [],
  modules: [],
  strategies: [],
})

describe("project-ops", () => {
  it("renamedProjects matches SpineSession / useStore rename rules", () => {
    const projects = [base("p1", "A"), base("p2", "B")]
    expect(renamedProjects(projects, "p1", "  ")).toBeNull()
    expect(renamedProjects(projects, "p1", "A")).toBeNull()
    const next = renamedProjects(projects, "p1", " Renamed ")
    expect(next?.map((p) => p.name)).toEqual(["Renamed", "B"])
  })

  it("withProjectDocumentation clears empty text", () => {
    const p = { ...base("p1", "A"), documentation: "hi" }
    expect(withProjectDocumentation(p, "hi")).toBe(p)
    expect(withProjectDocumentation(p, "  ").documentation).toBeUndefined()
    expect(withProjectDocumentation(p, "bye").documentation).toBe("bye")
  })

  it("deleteProjectSnapshot drops project, chat, and pending create", () => {
    const snap = {
      ...emptySessionSnapshot(),
      projects: [base("p1", "A"), base("p2", "B")],
      activeProjectId: "p1",
      pendingCreates: [base("p3", "C")],
      chatByProjectId: { p1: [{ role: "user" as const, content: "hi" }], p2: [] },
      chat: [{ role: "user" as const, content: "hi" }],
    }
    const next = deleteProjectSnapshot(snap, "p1")
    expect(next.projects.map((p) => p.id)).toEqual(["p2"])
    expect(next.activeProjectId).toBe("p2")
    expect(next.deletedProjectIds).toContain("p1")
    expect(next.pendingCreates.map((p) => p.id)).toEqual(["p3"])
    expect(next.chatByProjectId.p1).toBeUndefined()
    expect(next.chat).toEqual([])
  })

  it("patchProjectInList merges patch into one project row", () => {
    const projects = [base("p1", "A"), base("p2", "B")]
    const next = patchProjectInList(projects, "p1", { documentation: "doc" })
    expect(next[0].documentation).toBe("doc")
    expect(next[1]).toBe(projects[1])
  })

  it("projectPatchFromChanges promotes blank projects when models appear", () => {
    const model: StructureModel = {
      id: "m1" as StructureModelId,
      name: "Finding",
      description: "",
      fields: [{ id: "f1", name: "title", type: FieldType.Text, optional: false, description: "" }],
    }
    const project = {
      ...base("p1", "Blank"),
      modules: [
        {
          id: "mod_in",
          kind: ModuleKind.Input,
          label: "Input",
          note: "",
          cached: true,
          avgMs: 0,
          avgCostCents: 0,
        },
      ],
    }
    const patch = projectPatchFromChanges(project, { models: [model] }, "gpt-4")
    expect(patch?.kind).toBe(AUTHORED_PROJECT_KIND)
    expect(patch?.models?.map((m) => m.name)).toEqual(["Finding"])
    expect(patch?.modules?.length).toBeGreaterThan(0)
  })

  it("proposalGraphPatch adds a named function without replacing unnamed function modules", () => {
    const project: Project = {
      ...base("p1", "Pack"),
      modules: [
        {
          id: "mod_in",
          kind: ModuleKind.Input,
          label: "Input",
          note: "",
          cached: true,
          avgMs: 0,
          avgCostCents: 0,
        },
      ],
    }
    const extra = [
      {
        id: "mod_notes",
        kind: ModuleKind.Input,
        label: "Notes",
        note: "",
        cached: true,
        avgMs: 0,
        avgCostCents: 0,
      },
    ]
    const patch = proposalGraphPatch(
      project,
      {
        targetFunctionName: "Summarize",
        models: [],
        modules: extra,
        typeAliases: [],
        changed: {
          modules: true,
          models: false,
          typeAliases: false,
          docs: false,
          documentation: false,
          function: true,
        },
      },
      "gpt-4",
    )
    expect(patch?.functions).toHaveLength(2)
    expect(patch?.functions?.map((fn) => fn.name)).toEqual(["unnamed function", "Summarize"])
    expect(patch?.modules?.[0]?.label).toBe("Notes")
    expect(patch?.functions?.find((fn) => fn.name === "unnamed function")?.modules[0]?.id).toBe("mod_in")
  })
})
