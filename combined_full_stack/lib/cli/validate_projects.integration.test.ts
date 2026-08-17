import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProjectContext } from "@/lib/cli/project_context"
import { validateProjectCommand } from "@/lib/cli/validate_project"
import { validateSetupCommand } from "@/lib/cli/validate_setup"
import { runSpineCli } from "@/lib/cli/run"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"
import { SEEDS_DIR } from "@/lib/server/seed"
import type { CliCommandResult } from "@/lib/cli/types"

const seedFiles = readdirSync(SEEDS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()

function formatValidationFailure(file: string, result: CliCommandResult): string {
  if (result.ok) return file
  const lines = result.issues.map((i) => `  [${i.level}] ${i.where}: ${i.message}`)
  return `${file}:\n${lines.join("\n")}`
}

describe("bundled task examples — Structure / Pipeline UI gates", () => {
  it.each(seedFiles)("%s has no type or pipeline errors visible in the UI", (file) => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, file))
    const validity = computeWorkspaceValidity(
      ctx.project.modules,
      ctx.project.models,
      ctx.project.typeAliases ?? [],
    )
    const result = validateProjectCommand(ctx)

    expect(validity.typesInvalid, `${file}: Structure tab would show type errors`).toBe(false)
    expect(validity.pipelineInvalid, `${file}: Pipeline tab would block Inference / Testing`).toBe(false)
    expect(result.ok, formatValidationFailure(file, result)).toBe(true)
  })

  it.each(seedFiles)("spine cli validate project passes for %s", async (file) => {
    const seedPath = resolve(SEEDS_DIR, file)
    const result = await runSpineCli(["validate", "project", seedPath])
    expect(result.command).toBe("validate project")
    expect(result.ok, formatValidationFailure(file, result)).toBe(true)
  })
})

describe("homework grader — agent example baseline", () => {
  const homeworkSeed = resolve(SEEDS_DIR, "homework_grader.json")

  it("pipeline is clean before an agent builds variants from a task prompt", () => {
    const ctx = loadProjectContext(homeworkSeed)
    const result = validateProjectCommand(ctx)
    expect(result.ok, formatValidationFailure("homework_grader.json", result)).toBe(true)
    expect(result.data?.summary).toBe("project valid")
  })

  it("includes inference presets and bundled test files for multi-grade examples", () => {
    const ctx = loadProjectContext(homeworkSeed)
    const inferenceSetups = ctx.seed.docSpecs.filter((d) => d.name.endsWith("_inference.json"))
    const testFiles = ctx.seed.docSpecs.filter((d) => d.name.endsWith("_testing.json"))
    expect(inferenceSetups.length).toBeGreaterThanOrEqual(3)
    expect(testFiles.length).toBeGreaterThanOrEqual(5)
    expect(ctx.project.modules.some((m) => m.kind === "llm-batch")).toBe(true)
  })
})

describe("example select demo — inference presets", () => {
  const exampleSelectSeed = resolve(SEEDS_DIR, "example_select_demo.json")

  it("includes inference presets and bundled test files for multiple damage scenarios", () => {
    const ctx = loadProjectContext(exampleSelectSeed)
    const inferenceSetups = ctx.seed.docSpecs.filter((d) => d.name.endsWith("_inference.json"))
    const testFiles = ctx.seed.docSpecs.filter((d) => d.name.endsWith("_testing.json"))
    expect(inferenceSetups.length).toBeGreaterThanOrEqual(3)
    expect(testFiles.length).toBeGreaterThanOrEqual(3)
    expect(ctx.project.modules.some((m) => m.kind === "example-select")).toBe(true)
  })

  it("validates every bundled inference preset", () => {
    const ctx = loadProjectContext(exampleSelectSeed)
    const inferenceSetups = ctx.seed.docSpecs.filter((d) => d.name.endsWith("_inference.json"))
    for (const spec of inferenceSetups) {
      const result = validateSetupCommand(ctx, spec.path)
      expect(result.ok, `${spec.name}: ${result.issues.map((i) => i.message).join("; ")}`).toBe(true)
    }
  })
})

describe("web research scraper — python scrape + n8n-shaped hits", () => {
  const webResearchSeed = resolve(SEEDS_DIR, "web_research_scraper.json")

  it("includes a python scrape step and n8n-shaped search-hit fixtures", () => {
    const ctx = loadProjectContext(webResearchSeed)
    const scrape = ctx.project.modules.find((m) => m.label === "Scrape Pages")
    expect(scrape?.kind).toBe("custom-code")
    expect(scrape?.fallbackList?.some((e) => Boolean(e.python?.trim()))).toBe(true)
    expect(ctx.project.modules.some((m) => m.kind === "llm-batch")).toBe(true)
    expect(ctx.seed.docSpecs.some((d) => d.name === "search_hits.json")).toBe(true)
  })

  it("validates the bundled inference preset", () => {
    const ctx = loadProjectContext(webResearchSeed)
    const inferenceSetups = ctx.seed.docSpecs.filter((d) => d.name.endsWith("_inference.json"))
    expect(inferenceSetups.length).toBeGreaterThanOrEqual(1)
    for (const spec of inferenceSetups) {
      const result = validateSetupCommand(ctx, spec.path)
      expect(result.ok, `${spec.name}: ${result.issues.map((i) => i.message).join("; ")}`).toBe(true)
    }
  })
})

describe("billed work catalog select — structured catalog", () => {
  const billedWorkSeed = resolve(SEEDS_DIR, "billed_work_catalog_select.json")

  it("includes two example-select steps and a 100-item catalog fixture", () => {
    const ctx = loadProjectContext(billedWorkSeed)
    const selectSteps = ctx.project.modules.filter((m) => m.kind === "example-select")
    expect(selectSteps).toHaveLength(2)
    expect(ctx.project.modules.filter((m) => m.kind === "combine")).toHaveLength(1)
    expect(ctx.seed.docSpecs.some((d) => d.name === "work_item_catalog.json")).toBe(true)
  })

  it("validates every bundled inference preset", () => {
    const ctx = loadProjectContext(billedWorkSeed)
    const inferenceSetups = ctx.seed.docSpecs.filter((d) => d.name.endsWith("_inference.json"))
    for (const spec of inferenceSetups) {
      const result = validateSetupCommand(ctx, spec.path)
      expect(result.ok, `${spec.name}: ${result.issues.map((i) => i.message).join("; ")}`).toBe(true)
    }
  })
})
