import { describe, expect, it } from "vitest"
import { ModuleKind, RunStatus, RunStepStatus, RunTestStepStatus, type RunId } from "@/lib/types"
import type { PipelineRun } from "@/lib/types"
import {
  filterRunsByErrorStatus,
  runErrorLogText,
  runErrorSteps,
  runHasErrors,
} from "@/lib/run-error-log"

function runId(id: string): RunId {
  return id as RunId
}

function makeRun(partial: Partial<PipelineRun> & Pick<PipelineRun, "id">): PipelineRun {
  return {
    startedAt: Date.now(),
    status: RunStatus.Ok,
    totalMs: 100,
    billedCents: 0.5,
    savedCents: 0,
    model: "test-model",
    steps: [],
    ...partial,
  }
}

describe("run-error-log", () => {
  it("runHasErrors detects error status and error steps", () => {
    expect(runHasErrors(makeRun({ id: runId("a"), status: RunStatus.Error }))).toBe(true)
    expect(
      runHasErrors(
        makeRun({
          id: runId("b"),
          steps: [
            {
              moduleId: "m1" as never,
              kind: ModuleKind.Llm,
              label: "Step",
              status: RunStepStatus.Error,
              ms: 1,
              costCents: 0,
              inputPreview: "",
              outputPreview: "boom",
            },
          ],
        }),
      ),
    ).toBe(true)
    expect(runHasErrors(makeRun({ id: runId("c"), status: RunStatus.Ok }))).toBe(false)
  })

  it("filterRunsByErrorStatus keeps only failing runs", () => {
    const runs = [
      makeRun({ id: runId("ok"), status: RunStatus.Ok }),
      makeRun({ id: runId("err"), status: RunStatus.Error }),
    ]
    expect(filterRunsByErrorStatus(runs, "errors")).toHaveLength(1)
    expect(filterRunsByErrorStatus(runs, "errors")[0]!.id).toBe(runId("err"))
  })

  it("runErrorLogText includes only error step output", () => {
    const run = makeRun({
      id: runId("run-1"),
      status: RunStatus.Error,
      steps: [
        {
          moduleId: "m1" as never,
          kind: ModuleKind.Input,
          label: "Input",
          status: RunStepStatus.Ok,
          ms: 1,
          costCents: 0,
          inputPreview: "doc text",
          outputPreview: "parsed",
        },
        {
          moduleId: "m2" as never,
          kind: ModuleKind.Llm,
          label: "Extract",
          status: RunStepStatus.Error,
          ms: 2,
          costCents: 0.1,
          inputPreview: "in",
          outputPreview: "schema validation failed",
        },
      ],
    })
    const text = runErrorLogText(run)
    expect(text).toContain("schema validation failed")
    expect(text).not.toContain("parsed")
    expect(runErrorSteps(run)).toHaveLength(1)
    expect(runErrorSteps(run)[0]!.label).toBe("Extract")
  })

  it("runErrorLogText isolates test failures to diverging fields only", () => {
    const largeShared = {
      meta: { version: 1, title: "Homework batch", notes: "x".repeat(200) },
      students: [
        { id: "a", name: "Alex", score: 10 },
        { id: "b", name: "Jordan", score: 8 },
      ],
    }
    const run = makeRun({
      id: runId("test-run"),
      status: RunStatus.Ok,
      test: {
        testDocName: "homework_grader_testing.json",
        results: [
          {
            label: "Final Output",
            status: RunTestStepStatus.Fail,
            diffPath: "students[1].score",
            expected: { ...largeShared, students: [{ id: "a", name: "Alex", score: 10 }, { id: "b", name: "Jordan", score: 9 }] },
            actual: largeShared,
          },
        ],
      },
    })
    const text = runErrorLogText(run)
    expect(text).toContain("field: students[1].score")
    expect(text).toContain("expected:")
    expect(text).toContain("output:")
    expect(text).not.toContain("x".repeat(200))
    expect(text).not.toContain('"Alex"')
    expect(runHasErrors(run)).toBe(true)
  })

  it("runErrorLogText omits step input by default but includes it with includePipeline", () => {
    const run = makeRun({
      id: runId("batch-run"),
      status: RunStatus.Ok,
      steps: [
        {
          moduleId: "m1" as never,
          kind: ModuleKind.Llm,
          label: "Grade Each Section",
          status: RunStepStatus.Ok,
          ms: 1,
          costCents: 0,
          inputPreview: "",
          outputPreview: "ok",
          inputPreviewItems: [
            { label: "item 1/2", text: "long prompt body ".repeat(20) },
            { label: "item 2/2", text: "another prompt ".repeat(20) },
          ],
        },
      ],
      test: {
        testDocName: "homework_grader_testing.json",
        results: [
          {
            label: "Grade Each Section",
            status: RunTestStepStatus.Fail,
            diffPath: "[1].score",
            expected: [{ score: 5 }, { score: 5 }],
            actual: [{ score: 5 }, { score: 3 }],
          },
        ],
      },
    })
    const compact = runErrorLogText(run)
    expect(compact).toContain("input: 2 batched item(s)")
    expect(compact).toContain("relevant: item 2/2")
    expect(compact).not.toContain("long prompt body")

    const full = runErrorLogText(run, { includePipeline: true })
    expect(full).toContain("long prompt body")
  })
})
