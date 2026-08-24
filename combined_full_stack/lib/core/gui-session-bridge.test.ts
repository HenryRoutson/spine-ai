import { describe, expect, it } from "vitest"
import { buildGuiSessionSnapshot, createGuiSpineSession } from "@/lib/core/gui-session-bridge"
import { emptySessionSnapshot } from "@/lib/core/session"
import type { Project, ProjectId } from "@/lib/types"

const base = (id: string): Project => ({
  id: id as ProjectId,
  name: "A",
  kind: "blank",
  createdAt: 1,
  lastOpenedAt: 1,
  models: [],
  modules: [],
  strategies: [],
})

describe("gui-session-bridge", () => {
  it("buildGuiSessionSnapshot overlays store slices onto prior snap", () => {
    const prev = { ...emptySessionSnapshot(), pendingProposal: { projectName: "x" } as never }
    const snap = buildGuiSessionSnapshot(
      {
        projects: [base("p1")],
        activeProjectId: "p1",
        model: "gpt-4",
        docs: [],
        runs: [],
        inferenceInputDocIds: {},
        pendingCreates: [],
        deletedProjectIds: [],
      },
      prev,
    )
    expect(snap.projects.map((p) => p.id)).toEqual(["p1"])
    expect(snap.model).toBe("gpt-4")
    expect(snap.pendingProposal).toEqual(prev.pendingProposal)
  })

  it("createGuiSpineSession persist fires on mutation, not hydrate", () => {
    let persists = 0
    let scheduled: Project | undefined
    const session = createGuiSpineSession({
      onPersist: () => {
        persists += 1
      },
      scheduleProjectSave: (p) => {
        scheduled = p
      },
    })
    session.hydrateSnapshot(
      buildGuiSessionSnapshot({
        projects: [base("p1")],
        activeProjectId: "p1",
        model: "gpt-4",
        docs: [],
        runs: [],
        inferenceInputDocIds: {},
        pendingCreates: [],
        deletedProjectIds: [],
      }),
    )
    expect(persists).toBe(0)
    session.setDocumentation("# hi")
    expect(persists).toBe(1)
    expect(scheduled?.documentation).toBe("# hi")
  })
})
