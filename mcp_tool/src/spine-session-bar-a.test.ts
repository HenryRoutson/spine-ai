import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { createSpineSession } from "@/lib/core/session"
import { createFilePersist, hydratePendingCreates } from "@/lib/cli/session_persist"
import { askAgentFromSession, getProjectFromSession, validateProjectFromSession } from "./spine-session-bar-a.js"
import { InputType, ModuleKind, type ModuleId, type StructureModelId } from "@/lib/server/types"
import type { Project } from "@/lib/types"

vi.mock("@/lib/cli/agent", () => ({
  askAgent: vi.fn(() => new Promise(() => {})),
}))

describe("MCP Bar A session tools", () => {
  it("get_project / validate_project read a session file", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-bar-a-"))
    const sessionPath = join(dir, "session.json")
    try {
      const session = createSpineSession({ persist: createFilePersist(sessionPath) })
      const created = session.addProject({ open: true })
      session.renameProject(created.id, "MCP Project")
      const project = getProjectFromSession(sessionPath)
      expect(project.name).toBe("MCP Project")
      const validation = validateProjectFromSession(sessionPath)
      expect(validation.ok).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("validate_project overlays the pending vibe proposal", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-overlay-"))
    const sessionPath = join(dir, "session.json")
    try {
      const session = createSpineSession({ persist: createFilePersist(sessionPath) })
      session.addProject({ open: true })
      const blank = validateProjectFromSession(sessionPath)
      expect(blank.issues.some((i) => i.message.includes("select an output model") || i.message.includes("select a structure"))).toBe(
        true,
      )
      session.setPendingProposal({
        modules: [
          {
            id: "mod_in" as ModuleId,
            kind: ModuleKind.Input,
            label: "Receipt Uploads",
            note: "files",
            cached: true,
            avgMs: 0,
            avgCostCents: 0,
            inputType: InputType.Text,
            inputDescription: "receipts",
            outStructureId: "m_builtin_document" as StructureModelId,
          },
        ],
        models: [],
        typeAliases: [],
        docs: [],
        documentation: "",
        changed: {
          modules: true,
          models: false,
          typeAliases: false,
          docs: false,
          documentation: false,
        },
      })
      const overlay = validateProjectFromSession(sessionPath)
      expect(overlay.issues.some((i) => i.message.includes("select an output model"))).toBe(false)
      expect(overlay.ok).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("session_action project.add matches GUI addProject", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-action-"))
    const sessionPath = join(dir, "session.json")
    try {
      const { runSessionAction } = await import("./spine-session-bar-a.js")
      const created = (await runSessionAction({ id: "project.add", sessionPath })) as { id: string; name: string }
      expect(created.name).toBe("Untitled Pipeline")
      const renamed = (await runSessionAction({
        id: "project.rename",
        sessionPath,
        name: "From MCP",
        projectId: created.id,
      })) as { name: string }
      expect(renamed.name).toBe("From MCP")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("file persist stores pendingCreate ids without cloning projects already on disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-pending-"))
    const sessionPath = join(dir, "session.json")
    try {
      const persist = createFilePersist(sessionPath)
      const session = createSpineSession({ persist })
      const created = session.addProject({ open: true })
      const disk = JSON.parse(readFileSync(sessionPath, "utf8")) as {
        pendingCreateIds?: string[]
        pendingCreates?: Project[]
        projects?: Project[]
      }
      expect(disk.pendingCreateIds).toContain(created.id)
      expect(disk.pendingCreates ?? []).toEqual([])
      expect(disk.projects?.some((p) => p.id === created.id)).toBe(true)
      const hydrated = hydratePendingCreates(disk.projects ?? [], disk.pendingCreates, disk.pendingCreateIds)
      expect(hydrated.some((p) => p.id === created.id)).toBe(true)
      const reloaded = createSpineSession({ persist: createFilePersist(sessionPath) })
      expect(reloaded.getSnapshot().pendingCreates.some((p) => p.id === created.id)).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("add_step kind=n8n inserts a typed catalog piece", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-n8n-"))
    const sessionPath = join(dir, "session.json")
    try {
      const session = createSpineSession({ persist: createFilePersist(sessionPath) })
      session.addProject({ open: true })
      const { addStepFromSession, configureN8nStepFromSession } = await import("./spine-session-bar-a.js")
      const added = addStepFromSession("n8n", "Set fields", sessionPath)
      expect(added[0]?.kind).toBe("n8n")
      const configured = configureN8nStepFromSession({
        stepId: added[0]!.id,
        n8nNodeType: "n8n-nodes-base.set",
        parametersJson: JSON.stringify({ keepOnlySet: true, assignments: { name: "={{ $json.name }}" } }),
        sessionPath,
      })
      expect(configured.n8nNodeType).toBe("n8n-nodes-base.set")
      expect(configured.n8nParameters?.keepOnlySet).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("ask_agent returns inFlight without waiting for the agent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-ask-"))
    const sessionPath = join(dir, "session.json")
    try {
      const session = createSpineSession({ persist: createFilePersist(sessionPath) })
      session.addProject({ open: true })
      const started = Date.now()
      const first = await askAgentFromSession("build a pipeline", sessionPath)
      const second = await askAgentFromSession("build a pipeline", sessionPath)
      expect(Date.now() - started).toBeLessThan(2000)
      expect(first.data.inFlight).toBe(true)
      expect(second.data.inFlight).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("auth_status and kind aliases work on a fresh session file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-status-"))
    const sessionPath = join(dir, "session.json")
    try {
      const { authStatusFromSession, addProjectFromSession, addStepFromSession } = await import("./spine-session-bar-a.js")
      const empty = await authStatusFromSession(sessionPath)
      expect(empty.projectCount).toBe(0)
      expect(empty.next).toMatch(/add_project/)
      expect(empty.seeds.length).toBeGreaterThan(0)
      expect(empty.apiUrl).toMatch(/127\.0\.0\.1:3000/)
      addProjectFromSession(sessionPath)
      const added = addStepFromSession("HTTP", "Call API", sessionPath)
      expect(added[0]?.kind).toBe("webhook")
      const code = addStepFromSession("code", "Transform", sessionPath)
      expect(code[0]?.kind).toBe("custom-code")
      expect((await authStatusFromSession(sessionPath)).projectCount).toBe(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("get_project.next tells an agent to apply a pending proposal", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-next-"))
    const sessionPath = join(dir, "session.json")
    try {
      const session = createSpineSession({ persist: createFilePersist(sessionPath) })
      session.addProject({ open: true })
      session.setPendingProposal({
        modules: [],
        models: [],
        typeAliases: [],
        docs: [],
        documentation: "",
        projectName: "Pending Name",
        changed: {
          modules: true,
          models: false,
          typeAliases: false,
          docs: false,
          documentation: false,
          name: true,
        },
      })
      const project = getProjectFromSession(sessionPath)
      expect(project.pendingProposal).toBeTruthy()
      expect(project.next).toMatch(/apply_project_changes/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("linkQuotes / move-step / setDocProjects session_actions work", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-parity-"))
    const sessionPath = join(dir, "session.json")
    try {
      const {
        addProjectFromSession,
        addDocFromSession,
        addStepFromSession,
        linkQuotesFromSession,
        moveStepFromSession,
        setDocProjectsFromSession,
        runSessionAction,
      } = await import("./spine-session-bar-a.js")
      const project = addProjectFromSession(sessionPath)
      addDocFromSession({ sessionPath, name: "lease.txt", content: "keep the premises insured at all times" })
      const linked = linkQuotesFromSession({
        sessionPath,
        quote: "keep the premises insured",
        doc: "lease.txt",
      })
      expect(linked.quote.exact).toBe(true)
      const bound = setDocProjectsFromSession("lease.txt", [project.id], sessionPath)
      expect(bound.projectIds).toEqual([project.id])
      const added = addStepFromSession("llm", "Extract", sessionPath)
      const moved = await runSessionAction({
        id: "pipeline.move-step",
        sessionPath,
        stepId: added[0]!.id,
        at: 0,
      })
      expect(moved).toBeTruthy()
      moveStepFromSession(added[0]!.id, 1, sessionPath)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("import_seed lists available ids when the file is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-seed-miss-"))
    const sessionPath = join(dir, "session.json")
    try {
      const { addProjectFromSession, importSeedFromSession, listSeedsForMcp, removeDocFromSession, addDocFromSession, lintProjectFromSession } =
        await import("./spine-session-bar-a.js")
      addProjectFromSession(sessionPath)
      expect(() => importSeedFromSession("not_a_real_seed", sessionPath)).toThrow(/Available:/)
      const listed = listSeedsForMcp()
      expect(listed.seeds).toContain("lead_enrich_n8n")
      addDocFromSession({ sessionPath, name: "scratch.txt", content: "hi" })
      const after = removeDocFromSession("scratch.txt", sessionPath)
      expect(after.docs.some((d: { name: string }) => d.name === "scratch.txt")).toBe(false)
      const lint = lintProjectFromSession(sessionPath, false)
      expect(lint).toHaveProperty("ok")
      addDocFromSession({
        sessionPath,
        name: "demo_testing.json",
        content: JSON.stringify({ expectedOutputs: {} }),
      })
      const { pinpointFailureFromSession } = await import("./spine-session-bar-a.js")
      expect(() => pinpointFailureFromSession({ sessionPath }, ".")).toThrow(/demo_testing.json/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("start_run fails fast with a next hint when the API is down", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-run-down-"))
    const sessionPath = join(dir, "session.json")
    const prev = process.env.SPINE_API_URL
    try {
      process.env.SPINE_API_URL = "http://127.0.0.1:1"
      const { addProjectFromSession, startRunFromSession } = await import("./spine-session-bar-a.js")
      addProjectFromSession(sessionPath)
      await expect(startRunFromSession({ sessionPath })).rejects.toThrow(/not reachable|timed out talking/)
    } finally {
      if (prev === undefined) delete process.env.SPINE_API_URL
      else process.env.SPINE_API_URL = prev
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("corrupt session JSON returns a repair hint instead of crashing the process", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-corrupt-"))
    const sessionPath = join(dir, "session.json")
    try {
      const { writeFileSync } = await import("node:fs")
      writeFileSync(sessionPath, "{not-json")
      const { getProjectFromSession } = await import("./spine-session-bar-a.js")
      expect(() => getProjectFromSession(sessionPath)).toThrow(/not valid JSON/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
