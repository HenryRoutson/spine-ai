import { resolve } from "node:path"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { loadProjectContext } from "@/lib/cli/project_context"
import { validateTestContent } from "@/lib/cli/validate_test"
import { parseTestFile } from "@/lib/testing-files"
import {
  inputCompatBlockedForTest,
  loadTestInputContents,
  testOutcomePassed,
  syntheticInputCompatResults,
} from "@/lib/test-expect-failure"
import { SEEDS_DIR } from "@/lib/server/seed"

const homeworkSeed = resolve(SEEDS_DIR, "homework_grader.json")
const wrongPairingTest = resolve(
  SEEDS_DIR,
  "../documents/homework_grader/homework_wrong_pairing_testing.json",
)
const wrongGradeTest = resolve(
  SEEDS_DIR,
  "../documents/homework_grader/homework_wrong_grade_testing.json",
)

describe("expectFailure tests", () => {
  const ctx = loadProjectContext(homeworkSeed)

  it("validates wrong-pairing negative test and confirms inputs mismatch", () => {
    const content = readFileSync(wrongPairingTest, "utf8")
    const result = validateTestContent(ctx, content, wrongPairingTest)
    expect(result.ok).toBe(true)
    expect(result.issues.some((i) => i.where === "expectFailure")).toBe(true)

    const parsed = parseTestFile(content)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const contentByDocId = loadTestInputContents(parsed.test, ctx.project.modules, ctx.docRefs, (name) => {
      const spec = ctx.seed.docSpecs.find((d) => d.name === name)
      return spec ? readFileSync(spec.path, "utf8") : undefined
    })
    expect(inputCompatBlockedForTest(parsed.test, ctx.project.modules, ctx.docRefs, contentByDocId)).toBe(
      true,
    )
    const pairs = syntheticInputCompatResults([], true)
    expect(testOutcomePassed(parsed.test, pairs, null, true)).toBe(true)
    expect(testOutcomePassed(parsed.test, pairs, null, false)).toBe(false)
  })

  it("validates wrong-grade step-fail negative test structure", () => {
    const content = readFileSync(wrongGradeTest, "utf8")
    const result = validateTestContent(ctx, content, wrongGradeTest)
    expect(result.ok).toBe(true)
    const parsed = parseTestFile(content)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.test.expectFailure).toEqual({
      step: "Final Output",
      reason: "deliberately wrong expected score for Jordan Q2",
    })
    expect(parsed.test.expectedOutputs["Final Output"]).toBeTruthy()
  })
})
