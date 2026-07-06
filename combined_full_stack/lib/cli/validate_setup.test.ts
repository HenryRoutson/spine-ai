import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProjectContext } from "@/lib/cli/project_context"
import { validateSetupCommand } from "@/lib/cli/validate_setup"
import { SEEDS_DIR } from "@/lib/server/seed"

describe("validate setup command", () => {
  it("passes homework university inference preset", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "homework_grader.json"))
    const setupPath = resolve(SEEDS_DIR, "../documents/homework_grader/university_latex_inference.json")
    const result = validateSetupCommand(ctx, setupPath)
    expect(result.ok).toBe(true)
  })

  it("errors when setup file is invalid json", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "homework_grader.json"))
    const result = validateSetupCommand(ctx, resolve(SEEDS_DIR, "batch_llm_example.json"))
    expect(result.ok).toBe(false)
    expect(result.issues[0]?.message).toMatch(/invalid json|inputs/i)
  })

  it("errors when setup references unknown input step", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "homework_grader.json"))
    const dir = mkdtempSync(join(tmpdir(), "spine-setup-"))
    const path = join(dir, "bad_inference.json")
    writeFileSync(
      path,
      JSON.stringify({
        description: "bad",
        inputs: { "No Such Step": "university_latex_inference.json" },
      }),
    )
    try {
      const result = validateSetupCommand(ctx, path)
      expect(result.ok).toBe(false)
      expect(result.issues.some((i) => i.message.includes("input step not found"))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
