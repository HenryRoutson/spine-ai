import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { createSpineSession } from "@/lib/core/session"
import { createFilePersist } from "@/lib/cli/session_persist"
import { getProjectFromSession, validateProjectFromSession } from "./spine-session-bar-a.js"

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
})
