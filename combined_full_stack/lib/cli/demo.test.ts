import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { runSpineCli } from "@/lib/cli/run"
import { runDemoCommand } from "@/lib/cli/demo"

describe("spine demo + session CLI", () => {
  it("demo launches session CLI steps and passes the realtime overlay checks", async () => {
    const result = await runSpineCli(["demo"])
    expect(result.command).toBe("demo")
    expect(result.ok, JSON.stringify(result.issues)).toBe(true)
    expect(result.data?.actions).toEqual(expect.arrayContaining(["addProject", "linkQuotes", "validate"]))
    const launched = result.data?.launched as { command: string; ok: boolean }[]
    expect(launched.every((s) => s.ok)).toBe(true)
    expect(launched.map((s) => s.command)).toContain("session add-project")
    const realtime = result.data?.realtime as {
      keptAfterStale: boolean
      confirmed: boolean
      tombstoneHidesClone: boolean
      projectTicks: number
    }
    expect(realtime.keptAfterStale).toBe(true)
    expect(realtime.confirmed).toBe(true)
    expect(realtime.tombstoneHidesClone).toBe(true)
    expect(realtime.projectTicks).toBeGreaterThanOrEqual(1)
    expect(String(result.data?.human)).toContain("React store API via CLI")
  })

  it("sequential session commands share file persist like a React session", async () => {
    const dir = mkdtempSync(join(tmpdir(), "spine-session-"))
    const session = join(dir, "session.json")
    try {
      const created = await runSpineCli(["session", "add-project", "--session", session, "--open"])
      expect(created.ok).toBe(true)
      const id = (created.data?.project as { id: string }).id
      const renamed = await runSpineCli([
        "session",
        "rename",
        "--name",
        "From CLI",
        "--session",
        session,
      ])
      expect(renamed.ok).toBe(true)
      const modeled = await runSpineCli(["session", "add-model", "--name", "Finding", "--session", session])
      expect(modeled.ok).toBe(true)
      const listed = await runSpineCli(["session", "list", "--session", session])
      expect(listed.ok).toBe(true)
      const summary = listed.data?.summary as { activeName: string; activeProjectId: string }
      expect(summary.activeName).toBe("From CLI")
      expect(summary.activeProjectId).toBe(id)
      const validated = await runSpineCli(["session", "validate", "--session", session, "--offline"])
      expect(validated.ok).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("runDemoCommand is the same entry the CLI demo flag uses", async () => {
    const result = await runDemoCommand({})
    expect(result.ok).toBe(true)
    expect(result.command).toBe("demo")
  })

  it("session actions lists the React method names", async () => {
    const result = await runSpineCli(["session", "actions"])
    expect(result.ok).toBe(true)
    expect(result.data?.actions).toContain("addProject")
  })
})
