import { describe, expect, it, vi } from "vitest"
import { FieldType, InputType, DocLabel, type ProjectId } from "@/lib/types"
import { createSpineSession, createMemoryPersist, emptySessionSnapshot } from "@/lib/core/session"
import { createThrowingEgress, EgressBlockedError } from "@/lib/core/transport"
import { toPipelineView, toSessionSummary } from "@/lib/core/view"
import { SESSION_ACTION_IDS, addProjectAction } from "@/lib/core/actions"
import { uid } from "@/lib/id"
import type { StructureModel, StructureModelId } from "@/lib/types"

describe("SpineSession React-like API", () => {
  it("addProject / open / rename / delete match useStore names", () => {
    const store = createSpineSession()
    const created = store.addProject({ open: true })
    expect(store.activeProjectId).toBe(created.id)
    expect(store.project?.name).toBe("Untitled Pipeline")

    store.renameProject(created.id, "Lease Review")
    expect(store.project?.name).toBe("Lease Review")

    store.setDocumentation("# Notes")
    expect(store.documentation).toBe("# Notes")

    const clone = store.cloneProject(created.id, { open: false })
    expect(clone.name).toBe("Lease Review 1")
    expect(store.activeProjectId).toBe(created.id)

    store.deleteProject(clone.id)
    expect(store.projects.some((p) => p.id === clone.id)).toBe(false)
    expect(store.projects.some((p) => p.id === created.id)).toBe(true)
  })

  it("subscribe notifies on mutations", () => {
    const store = createSpineSession()
    const ticks: string[] = []
    const stop = store.subscribe(() => {
      ticks.push(store.activeProjectId)
    })
    store.addProject({ open: true })
    store.renameProject(store.activeProjectId, "A")
    stop()
    store.renameProject(store.activeProjectId, "B")
    expect(ticks.length).toBe(2)
    expect(store.project?.name).toBe("B")
  })

  it("applyProjectChanges is atomic like the React store", () => {
    const store = createSpineSession()
    store.addProject({ open: true })
    const model: StructureModel = {
      id: uid<StructureModelId>("m_"),
      name: "Finding",
      description: "",
      fields: [
        { id: uid("f_"), name: "summary", type: FieldType.Text, optional: false, description: "" },
      ],
    }
    store.applyProjectChanges({ models: [model], documentation: "updated" })
    expect(store.project?.models.map((m) => m.name)).toEqual(["Finding"])
    expect(store.documentation).toBe("updated")
  })

  it("scopes vibe chat to the active project", () => {
    const store = createSpineSession()
    const first = store.addProject({ open: true })
    store.appendChat({ role: "user", content: "invoice pipeline" })
    const second = store.addProject({ open: true })
    expect(store.chat).toEqual([])
    store.appendChat({ role: "user", content: "resume pipeline" })
    expect(store.chat.map((t) => t.content)).toEqual(["resume pipeline"])
    store.openProject(first.id)
    expect(store.chat.map((t) => t.content)).toEqual(["invoice pipeline"])
    expect(second.id).not.toBe(first.id)
  })

  it("does not dump mixed global chat onto the active project when several projects exist", () => {
    const persist = createMemoryPersist({
      ...emptySessionSnapshot(),
      projects: [
        { id: "p_receipts" as ProjectId, name: "Receipts", kind: "blank", createdAt: 1, lastOpenedAt: 1, models: [], modules: [], strategies: [] },
        { id: "p_resumes" as ProjectId, name: "Resumes", kind: "blank", createdAt: 2, lastOpenedAt: 2, models: [], modules: [], strategies: [] },
      ],
      activeProjectId: "p_resumes",
      chat: [
        { role: "user", content: "invoice pipeline" },
        { role: "user", content: "resume pipeline" },
      ],
    })
    const store = createSpineSession({ persist })
    expect(store.chat).toEqual([])
    store.openProject("p_receipts")
    expect(store.chat).toEqual([])
  })

  it("does not copy orphan global chat onto a leftover blank project", () => {
    const persist = createMemoryPersist({
      ...emptySessionSnapshot(),
      projects: [
        { id: "p_blank" as ProjectId, name: "Untitled Pipeline", kind: "blank", createdAt: 3, lastOpenedAt: 3, models: [], modules: [], strategies: [] },
      ],
      activeProjectId: "p_blank",
      chat: [
        { role: "user", content: "invoice pipeline" },
        { role: "assistant", content: "receipts" },
      ],
    })
    const store = createSpineSession({ persist })
    expect(store.chat).toEqual([])
  })

  it("persists per-project chat across session instances", () => {
    const persist = createMemoryPersist()
    const a = createSpineSession({ persist })
    const first = a.addProject({ open: true })
    a.appendChat({ role: "user", content: "invoice pipeline" })
    a.addProject({ open: true })
    a.appendChat({ role: "user", content: "resume pipeline" })
    const b = createSpineSession({ persist })
    expect(b.chat.map((t) => t.content)).toEqual(["resume pipeline"])
    b.openProject(first.id)
    expect(b.chat.map((t) => t.content)).toEqual(["invoice pipeline"])
  })

  it("addDocContent hashes locally and linkQuotes never needs the network", () => {
    const store = createSpineSession({ egress: createThrowingEgress() })
    store.addProject({ open: true })
    const source = "The tenant must keep the premises insured at all times."
    const doc = store.addDocContent({
      name: "lease.txt",
      type: InputType.Text,
      content: source,
      label: DocLabel.Inference,
    })
    const linked = store.linkQuotes({
      quote: "keep the premises insured",
      sourceText: source,
      docId: doc.id,
    })
    expect(linked.exact).toBe(true)
    expect(linked.href).toContain(doc.id)
    expect(linked.start).toBeLessThan(linked.end)
    expect(store.egress?.bytesSent).toBe(0)
  })

  it("toPipelineView reads the same snapshot CLI would render", () => {
    const store = createSpineSession()
    store.addProject({ open: true })
    const view = toPipelineView(store.getSnapshot())
    expect(view?.title).toBe("Untitled Pipeline")
    expect(view?.steps.map((s) => s.kind)).toEqual(["input", "output"])
  })

  it("memory persist round-trips across session instances", () => {
    const persist = createMemoryPersist()
    const a = createSpineSession({ persist })
    const p = a.addProject({ open: true })
    a.renameProject(p.id, "Saved")
    const b = createSpineSession({ persist })
    expect(b.project?.name).toBe("Saved")
    expect(toSessionSummary(b.getSnapshot()).projectCount).toBe(1)
  })

  it("addProject action registry id matches the React method name", () => {
    const store = createSpineSession()
    const project = addProjectAction.run(store, { open: true })
    expect(project.id).toBe(store.activeProjectId)
    expect(SESSION_ACTION_IDS).toContain("addProject")
    expect(SESSION_ACTION_IDS).toContain("linkQuotes")
    expect(SESSION_ACTION_IDS).toContain("startRun")
    expect(SESSION_ACTION_IDS).toContain("askAgent")
  })

  it("throwing egress is unused by local actions", () => {
    const egress = createThrowingEgress()
    const store = createSpineSession({ egress })
    expect(() => store.addProject({ open: true })).not.toThrow(EgressBlockedError)
    expect(() => store.validation()).not.toThrow()
  })

  it("applyProposal matches the in-app approve path", () => {
    const store = createSpineSession()
    store.addProject({ open: true })
    const model: StructureModel = {
      id: uid<StructureModelId>("m_"),
      name: "Finding",
      description: "",
      fields: [
        { id: uid("f_"), name: "summary", type: FieldType.Text, optional: false, description: "" },
      ],
    }
    store.setPendingProposal({
      modules: store.modules,
      models: [model],
      typeAliases: [],
      docs: [
        {
          name: "lease.txt",
          type: InputType.Text,
          content: "insured premises",
          label: DocLabel.Inference,
        },
      ],
      documentation: "Agent wrote this",
      projectName: "Lease Review",
      changed: {
        modules: false,
        models: true,
        typeAliases: false,
        docs: true,
        documentation: true,
        name: true,
      },
    })
    expect(store.applyPendingProposal()).toBe(true)
    expect(store.project?.name).toBe("Lease Review")
    expect(store.project?.models.map((m) => m.name)).toEqual(["Finding"])
    expect(store.documentation).toBe("Agent wrote this")
    expect(store.docs.some((d) => d.name === "lease.txt")).toBe(true)
    expect(store.pendingProposal).toBeNull()
  })

  it("startRun fails closed without HTTP egress", async () => {
    const store = createSpineSession({ egress: createThrowingEgress() })
    store.addProject({ open: true })
    await expect(store.startRun()).rejects.toThrow(EgressBlockedError)
  })

  it("cloneFromTemplate aliases ingestProject", () => {
    const store = createSpineSession()
    const a = store.addProject({ open: true })
    store.renameProject(a.id, "Template")
    const source = store.project!
    const b = store.cloneFromTemplate(source, { open: false })
    expect(b.id).not.toBe(source.id)
    expect(b.name).toBe("Template")
  })
})
