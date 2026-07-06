import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { parseTestFile, testFileSkeleton } from "@/lib/testing-files"
import {
  docRefsFromSeed,
  inferenceDocsInSeed,
  loadProjectContext,
  testingDocsInSeed,
} from "@/lib/cli/project_context"
import { SEEDS_DIR } from "@/lib/server/seed"

describe("project context", () => {
  it("loads doc refs from seed metadata", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "batch_llm_example.json"))
    expect(ctx.docRefs.some((d) => d.name === "sample_bullets.txt")).toBe(true)
    expect(inferenceDocsInSeed(ctx).length).toBeGreaterThan(0)
  })

  it("testingDocsInSeed lists only *_testing.json specs", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "batch_llm_example.json"))
    const docs = testingDocsInSeed(ctx)
    expect(docs.length).toBeGreaterThan(0)
    expect(docs.every((d) => d.name.endsWith("_testing.json"))).toBe(true)
  })

  it("docRefsFromSeed preserves seed doc metadata", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "batch_llm_example.json"))
    const bullet = docRefsFromSeed(ctx.seed).find((d) => d.name === "sample_bullets.txt")
    expect(bullet?.type).toBe("text")
    expect(bullet?.label).toBeTruthy()
  })

  it("testFileSkeleton matches parseTestFile schema", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "batch_llm_example.json"))
    const skeleton = testFileSkeleton(ctx.project, ctx.docRefs)
    const parsed = parseTestFile(skeleton)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.test.expectedOutputs).toBeTruthy()
      expect(parsed.test.inputs).toBeTruthy()
    }
  })
})
