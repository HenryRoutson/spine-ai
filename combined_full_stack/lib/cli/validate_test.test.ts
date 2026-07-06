import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProjectContext } from "@/lib/cli/project_context"
import {
  parseTestCommand,
  validateTestCommand,
  validateTestContent,
  validateTestsCommand,
} from "@/lib/cli/validate_test"
import { SEEDS_DIR } from "@/lib/server/seed"

const batchSeed = resolve(SEEDS_DIR, "batch_llm_example.json")
const batchTest = resolve(SEEDS_DIR, "../documents/batch_llm_example/batch_llm_example_testing.json")

describe("validate test command", () => {
  it("parseTestCommand loads expectedOutputs from disk", () => {
    const result = parseTestCommand(batchTest)
    expect(result.ok).toBe(true)
    const test = result.data?.test as { expectedOutputs?: Record<string, unknown> }
    expect(test.expectedOutputs?.["Summary Report"]).toBeTruthy()
  })

  it("validateTestContent flags orphaned pipeline steps", () => {
    const ctx = loadProjectContext(batchSeed)
    const content = JSON.stringify({
      description: "orphan step",
      inputs: { "Bullet List": "sample_bullets.txt" },
      expectedOutputs: { "Ghost Step": { title: "nope" } },
    })
    const result = validateTestContent(ctx, content, "inline.json")
    expect(result.ok).toBe(false)
    const alignment = result.data?.alignment as { orphanedExpected?: { label: string }[] }
    expect(alignment.orphanedExpected?.[0]?.label).toBe("Ghost Step")
  })

  it("validateTestContent warns on null expected output placeholders", () => {
    const ctx = loadProjectContext(batchSeed)
    const content = JSON.stringify({
      description: "placeholder",
      inputs: { "Bullet List": "sample_bullets.txt" },
      expectedOutputs: { "Summary Report": null },
    })
    const result = validateTestContent(ctx, content, "inline.json")
    expect(result.ok).toBe(true)
    expect(result.issues.some((i) => i.level === "warning" && i.message.includes("placeholder"))).toBe(true)
  })

  it("validateTestContent errors on missing input doc", () => {
    const ctx = loadProjectContext(batchSeed)
    const content = JSON.stringify({
      description: "missing doc",
      inputs: { "Bullet List": "does_not_exist.txt" },
      expectedOutputs: {
        "Wrap → List": [],
        "Summary Report": { title: "t", body: "b" },
      },
    })
    const result = validateTestContent(ctx, content, "inline.json")
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.message.includes('document "does_not_exist.txt" not found'))).toBe(true)
  })

  it("validateTestContent rejects invalid json", () => {
    const ctx = loadProjectContext(batchSeed)
    const result = validateTestContent(ctx, "{ not json", "broken.json")
    expect(result.ok).toBe(false)
    expect(result.issues[0]?.message).toMatch(/invalid json/i)
  })

  it("validateTestContent rejects missing expectedOutputs object", () => {
    const ctx = loadProjectContext(batchSeed)
    const result = validateTestContent(ctx, JSON.stringify({ description: "empty" }), "empty.json")
    expect(result.ok).toBe(false)
    expect(result.issues[0]?.message).toMatch(/expectedOutputs/i)
  })

  it("validateTestCommand reads golden test file from disk", () => {
    const ctx = loadProjectContext(batchSeed)
    const result = validateTestCommand(ctx, batchTest)
    expect(result.ok).toBe(true)
    expect(result.data?.testFile).toBe(batchTest)
  })

  it("validateTestsCommand aggregates per-file stats", () => {
    const ctx = loadProjectContext(batchSeed)
    const result = validateTestsCommand(ctx)
    const perFile = result.data?.perFile as Record<
      string,
      { ok: boolean; errors: number; warnings: number }
    >
    expect(result.data?.testCount).toBeGreaterThan(0)
    expect(Object.keys(perFile).every((name) => name.endsWith("_testing.json"))).toBe(true)
  })

  it("validateTestContent reports orphaned input steps", () => {
    const ctx = loadProjectContext(batchSeed)
    const content = JSON.stringify({
      description: "orphan input",
      inputs: { "Unknown Input Step": "sample_bullets.txt" },
      expectedOutputs: { "Summary Report": { title: "t", body: "b" } },
    })
    const result = validateTestContent(ctx, content, "inline.json")
    const alignment = result.data?.alignment as { orphanedInputs?: { label: string }[] }
    expect(alignment.orphanedInputs?.[0]?.label).toBe("Unknown Input Step")
  })
})
