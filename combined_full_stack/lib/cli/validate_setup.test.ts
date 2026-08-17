import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProjectContext } from "@/lib/cli/project_context"
import { validateSetupCommand } from "@/lib/cli/validate_setup"
import { SEEDS_DIR } from "@/lib/server/seed"

const exampleSelectSeed = resolve(SEEDS_DIR, "example_select_demo.json")
const exampleSelectDocs = resolve(SEEDS_DIR, "../documents/example_select_demo")
const exampleSelect2Seed = resolve(SEEDS_DIR, "billed_work_catalog_select.json")
const exampleSelect2Docs = resolve(SEEDS_DIR, "../documents/billed_work_catalog_select")
const estimateIntelSeed = resolve(SEEDS_DIR, "estimate_intelligence.json")
const estimateIntelDocs = resolve(SEEDS_DIR, "../documents/estimate_intelligence")

describe("validate setup command", () => {
  it("passes homework university inference preset", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "homework_grader.json"))
    const setupPath = resolve(SEEDS_DIR, "../documents/homework_grader/university_latex_inference.json")
    const result = validateSetupCommand(ctx, setupPath)
    expect(result.ok).toBe(true)
  })

  it.each([
    "example_select_demo_inference.json",
    "roof_storm_inference.json",
    "kitchen_reno_inference.json",
  ])("passes example select inference preset %s", (file) => {
    const ctx = loadProjectContext(exampleSelectSeed)
    const result = validateSetupCommand(ctx, resolve(exampleSelectDocs, file))
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true)
  })

  it("passes billed work catalog select inference preset", () => {
    const ctx = loadProjectContext(exampleSelect2Seed)
    const result = validateSetupCommand(
      ctx,
      resolve(exampleSelect2Docs, "billed_work_catalog_select_inference.json"),
    )
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true)
  })

  it.each(["estimate_intelligence_inference.json", "roof_storm_inference.json"])(
    "passes estimate intelligence inference preset %s",
    (file) => {
      const ctx = loadProjectContext(estimateIntelSeed)
      const result = validateSetupCommand(ctx, resolve(estimateIntelDocs, file))
      expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true)
    },
  )

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
