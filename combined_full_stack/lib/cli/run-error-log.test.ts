import { describe, expect, it } from "vitest"
import { ModuleKind, RunStatus, RunStepStatus, type RunId } from "@/lib/types"
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
})
