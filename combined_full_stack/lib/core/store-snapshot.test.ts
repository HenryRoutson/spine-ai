import { describe, expect, it } from "vitest"
import { sessionSnapshotFromStore } from "@/lib/core/store-snapshot"
import { toDocsView, toMermaidView } from "@/lib/core/view"
import { ModuleKind, type ModuleId, type Project, type ProjectId } from "@/lib/types"

describe("sessionSnapshotFromStore", () => {
  it("feeds the same docs/mermaid ViewModels as CLI", () => {
    const id = "p_demo" as ProjectId
    const project: Project = {
      id,
      name: "Demo",
      kind: "blank",
      createdAt: 1,
      lastOpenedAt: 1,
      models: [],
      modules: [
        {
          id: "mod_in" as ModuleId,
          kind: ModuleKind.Input,
          label: "Input",
          note: "",
          cached: true,
          avgMs: 0,
          avgCostCents: 0,
        },
      ],
      strategies: [],
      documentation: "# Hello",
    }
    const snap = sessionSnapshotFromStore({
      projects: [project],
      activeProjectId: id,
      documentation: "# Hello",
      modules: project.modules,
      models: [],
    })
    expect(toDocsView(snap).markdown).toBe("# Hello")
    expect(toDocsView(snap).preview).toContain("Hello")
    expect(toMermaidView(snap, "dark")).toContain("flowchart")
  })
})
