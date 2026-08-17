import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { runSpineCli } from "@/lib/cli/run"
import { SEEDS_DIR } from "@/lib/server/seed"

const batchSeed = resolve(SEEDS_DIR, "batch_llm_example.json")
const batchTest = resolve(SEEDS_DIR, "../documents/batch_llm_example/batch_llm_example_testing.json")
const homeworkSeed = resolve(SEEDS_DIR, "homework_grader.json")
const homeworkSetup = resolve(SEEDS_DIR, "../documents/homework_grader/university_latex_inference.json")
const exampleSelectSeed = resolve(SEEDS_DIR, "example_select_demo.json")
const exampleSelectSetup = resolve(SEEDS_DIR, "../documents/example_select_demo/roof_storm_inference.json")
const exampleSelectTest = resolve(SEEDS_DIR, "../documents/example_select_demo/kitchen_reno_testing.json")
const exampleSelect2Seed = resolve(SEEDS_DIR, "billed_work_catalog_select.json")
const exampleSelect2Setup = resolve(SEEDS_DIR, "../documents/billed_work_catalog_select/billed_work_catalog_select_inference.json")
const exampleSelect2Test = resolve(SEEDS_DIR, "../documents/billed_work_catalog_select/billed_work_catalog_select_testing.json")
const webResearchSeed = resolve(SEEDS_DIR, "web_research_scraper.json")
const webResearchSetup = resolve(SEEDS_DIR, "../documents/web_research_scraper/web_research_scraper_inference.json")
const webResearchTest = resolve(SEEDS_DIR, "../documents/web_research_scraper/web_research_scraper_testing.json")

describe("spine cli run", () => {
  it("returns help for empty argv", async () => {
    const result = await runSpineCli([])
    expect(result.command).toBe("help")
    expect(result.ok).toBe(true)
    expect(result.data?.help).toContain("validate project")
  })

  it("returns usage error for unknown command", async () => {
    const result = await runSpineCli(["nope"])
    expect(result.command).toBe("usage")
    expect(result.ok).toBe(false)
  })

  it("parse test accepts a valid testing json file", async () => {
    const result = await runSpineCli(["parse", "test", "--file", batchTest])
    expect(result.ok).toBe(true)
    expect(result.data?.test).toBeTruthy()
  })

  it("parse test rejects invalid json", async () => {
    const result = await runSpineCli(["parse", "test", "--file", batchSeed])
    expect(result.ok).toBe(false)
    expect(result.issues[0]?.message).toMatch(/invalid json|expectedOutputs/i)
  })

  it("validate project passes for batch_llm_example seed", async () => {
    const result = await runSpineCli(["validate", "project", batchSeed])
    expect(result.command).toBe("validate project")
    expect(result.ok).toBe(true)
    expect(result.data?.projectName).toBe("Batch LLM Example")
  })

  it("validate test passes golden batch_llm fixture", async () => {
    const result = await runSpineCli([
      "validate",
      "test",
      "--project",
      batchSeed,
      "--file",
      batchTest,
    ])
    expect(result.command).toBe("validate test")
    expect(result.ok).toBe(true)
    expect(result.issues.filter((i) => i.level === "error")).toHaveLength(0)
  })

  it("validate tests scans every *_testing.json in the seed", async () => {
    const result = await runSpineCli(["validate", "tests", "--project", batchSeed])
    expect(result.command).toBe("validate tests")
    expect(result.data?.testCount).toBeGreaterThan(0)
  })

  it("validate test requires both project and file flags", async () => {
    const result = await runSpineCli(["validate", "test", "--project", batchSeed])
    expect(result.command).toBe("usage")
    expect(result.ok).toBe(false)
  })

  it("returns help for --help, -h, and help subcommand", async () => {
    for (const argv of [["--help"], ["-h"], ["help"]]) {
      const result = await runSpineCli(argv)
      expect(result.command).toBe("help")
      expect(result.data?.help).toContain("parse test")
    }
  })

  it("returns usage when required paths or flags are missing", async () => {
    expect((await runSpineCli(["validate", "project"])).command).toBe("usage")
    expect((await runSpineCli(["parse", "test"])).issues[0]?.message).toMatch(/--file/)
    expect((await runSpineCli(["validate", "tests"])).command).toBe("usage")
    expect((await runSpineCli(["validate", "setup", "--project", batchSeed])).command).toBe("usage")
  })

  it("validate setup passes homework inference preset", async () => {
    const result = await runSpineCli([
      "validate",
      "setup",
      "--project",
      homeworkSeed,
      "--file",
      homeworkSetup,
    ])
    expect(result.command).toBe("validate setup")
    expect(result.ok).toBe(true)
    expect(result.data?.setupFile).toBe(homeworkSetup)
  })

  it("validate setup passes example select roof storm preset", async () => {
    const result = await runSpineCli([
      "validate",
      "setup",
      "--project",
      exampleSelectSeed,
      "--file",
      exampleSelectSetup,
    ])
    expect(result.command).toBe("validate setup")
    expect(result.ok).toBe(true)
    expect(result.data?.setupFile).toBe(exampleSelectSetup)
  })

  it("validate test passes example select kitchen reno fixture", async () => {
    const result = await runSpineCli([
      "validate",
      "test",
      "--project",
      exampleSelectSeed,
      "--file",
      exampleSelectTest,
    ])
    expect(result.command).toBe("validate test")
    expect(result.ok).toBe(true)
    expect(result.issues.filter((i) => i.level === "error")).toHaveLength(0)
  })

  it("validate setup passes billed work catalog select inference preset", async () => {
    const result = await runSpineCli([
      "validate",
      "setup",
      "--project",
      exampleSelect2Seed,
      "--file",
      exampleSelect2Setup,
    ])
    expect(result.command).toBe("validate setup")
    expect(result.ok).toBe(true)
  })

  it("validate test passes billed work catalog select fixture", async () => {
    const result = await runSpineCli([
      "validate",
      "test",
      "--project",
      exampleSelect2Seed,
      "--file",
      exampleSelect2Test,
    ])
    expect(result.command).toBe("validate test")
    expect(result.ok).toBe(true)
    expect(result.issues.filter((i) => i.level === "error")).toHaveLength(0)
  })

  it("validate setup passes web research scraper inference preset", async () => {
    const result = await runSpineCli([
      "validate",
      "setup",
      "--project",
      webResearchSeed,
      "--file",
      webResearchSetup,
    ])
    expect(result.command).toBe("validate setup")
    expect(result.ok).toBe(true)
    expect(result.data?.setupFile).toBe(webResearchSetup)
  })

  it("validate test passes web research scraper fixture", async () => {
    const result = await runSpineCli([
      "validate",
      "test",
      "--project",
      webResearchSeed,
      "--file",
      webResearchTest,
    ])
    expect(result.command).toBe("validate test")
    expect(result.ok).toBe(true)
    expect(result.issues.filter((i) => i.level === "error")).toHaveLength(0)
  })
})
