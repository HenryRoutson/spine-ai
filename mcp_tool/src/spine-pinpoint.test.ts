import "./bootstrap-env.js"
import { describe, expect, it } from "vitest"
import { ModuleKind, RunStatus, RunStepStatus, type RunId } from "@/lib/types"
import type { PipelineRun } from "@/lib/types"
import { pinpointFailure, validateTestFile } from "./spine-pinpoint.js"

const REPO = process.env.SPINE_REPO_ROOT!
const SEED = "combined_full_stack/seeds/homework_grader.json"
const TEST = "combined_full_stack/documents/homework_grader/homework_wrong_grade_testing.json"

function runId(id: string): RunId {
  return id as RunId
}

function makeRun(steps: PipelineRun["steps"]): PipelineRun {
  return {
    id: runId("mcp-test-run"),
    startedAt: Date.now(),
    status: RunStatus.Ok,
    totalMs: 1,
    billedCents: 0,
    savedCents: 0,
    model: "test",
    steps,
  }
}

describe("spine-pinpoint", () => {
  it("validates a negative-test file against the seed", () => {
    const result = validateTestFile({ projectSeedPath: SEED, testFilePath: TEST }, REPO)
    expect(result.ok).toBe(true)
  })

  it("pinpoints the expected failure step for a deliberate wrong grade", () => {
    const result = pinpointFailure(
      {
        projectSeedPath: SEED,
        testFilePath: TEST,
        runJson: JSON.stringify(
          makeRun([
            {
              moduleId: "final" as never,
              kind: ModuleKind.Output,
              label: "Final Output",
              status: RunStepStatus.Ok,
              ms: 1,
              costCents: 0,
              inputPreview: "",
              outputPreview: "",
              outputJson: JSON.stringify([
                {
                  student_label: "Jordan Lee",
                  section_id: "A",
                  score: 5,
                  max_score: 5,
                  correct: true,
                  mistake_explanation: null,
                },
                {
                  student_label: "Jordan Lee",
                  section_id: "A",
                  score: 2,
                  max_score: 5,
                  correct: false,
                  mistake_explanation: "final y = 8, not 9",
                },
              ]),
            },
          ]),
        ),
      },
      REPO,
    )

    expect(result.passed).toBe(true)
    expect(result.firstFailure?.step).toBe("Final Output")
    expect(result.firstFailure?.isolatedText).toContain("Final Output")
  })
})
