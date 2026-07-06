import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { runSpineCli } from "@/lib/cli/run"
import { SEEDS_DIR } from "@/lib/server/seed"

const batchSeed = resolve(SEEDS_DIR, "batch_llm_example.json")
const batchTest = resolve(SEEDS_DIR, "../documents/batch_llm_example/batch_llm_example_testing.json")
const homeworkSeed = resolve(SEEDS_DIR, "homework_grader.json")
const homeworkSetup = resolve(SEEDS_DIR, "../documents/homework_grader/university_latex_inference.json")

describe("spine cli run", () => {
  it("returns help for empty argv", () => {
    const result = runSpineCli([])
    expect(result.command).toBe("help")
    expect(result.ok).toBe(true)
    expect(result.data?.help).toContain("validate project")
  })

  it("returns usage error for unknown command", () => {
    const result = runSpineCli(["nope"])
    expect(result.command).toBe("usage")
    expect(result.ok).toBe(false)
  })

  it("parse test accepts a valid testing json file", () => {
    const result = runSpineCli(["parse", "test", "--file", batchTest])
    expect(result.ok).toBe(true)
    expect(result.data?.test).toBeTruthy()
  })

  it("parse test rejects invalid json", () => {
    const result = runSpineCli(["parse", "test", "--file", batchSeed])
    expect(result.ok).toBe(false)
    expect(result.issues[0]?.message).toMatch(/invalid json|expectedOutputs/i)
  })

  it("validate project passes for batch_llm_example seed", () => {
    const result = runSpineCli(["validate", "project", batchSeed])
    expect(result.command).toBe("validate project")
    expect(result.ok).toBe(true)
    expect(result.data?.projectName).toBe("Batch LLM Example")
  })

  it("validate test passes golden batch_llm fixture", () => {
    const result = runSpineCli([
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

  it("validate tests scans every *_testing.json in the seed", () => {
    const result = runSpineCli(["validate", "tests", "--project", batchSeed])
    expect(result.command).toBe("validate tests")
    expect(result.data?.testCount).toBeGreaterThan(0)
  })

  it("validate test requires both project and file flags", () => {
    const result = runSpineCli(["validate", "test", "--project", batchSeed])
    expect(result.command).toBe("usage")
    expect(result.ok).toBe(false)
  })

  it("returns help for --help, -h, and help subcommand", () => {
    for (const argv of [["--help"], ["-h"], ["help"]]) {
      const result = runSpineCli(argv)
      expect(result.command).toBe("help")
      expect(result.data?.help).toContain("parse test")
    }
  })

  it("returns usage when required paths or flags are missing", () => {
    expect(runSpineCli(["validate", "project"]).command).toBe("usage")
    expect(runSpineCli(["parse", "test"]).issues[0]?.message).toMatch(/--file/)
    expect(runSpineCli(["validate", "tests"]).command).toBe("usage")
    expect(runSpineCli(["validate", "setup", "--project", batchSeed]).command).toBe("usage")
  })

  it("validate setup passes homework inference preset", () => {
    const result = runSpineCli([
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
})
