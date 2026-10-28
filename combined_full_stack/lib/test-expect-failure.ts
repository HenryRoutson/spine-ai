import { orderedInputModules } from "@/lib/inference-input-core"
import {
  evaluateInputCompat,
  inputCompatHasMismatch,
  type InputCompatPairResult,
} from "@/lib/input-compat"
import { resolveNamedRunInputs } from "@/lib/inference-presets"
import { labelAsStateKey } from "@/lib/server/pipeline_state"
import { RunTestStepStatus } from "@/lib/types"
import type { DocRef, PipelineModule, PipelineRun, Project } from "@/lib/types"
import type { TestStepResult } from "@/lib/testing-files"

export type TestExpectStepFailure = { step: string; reason?: string }

export type TestExpectFailure = "input-compat" | "run-error" | TestExpectStepFailure

// AI : UI-facing test outcome modes — maps 1:1 to expectFailure except pass (undefined).
export type TestOutcomeMode = "pass" | "step-failure" | "input-validation-error" | "run-error"

export type TestCompareColumnLabels = {
  expected: string
  actual: string
}

export type TestOutcomeModeInfo = {
  label: string
  summary: string
  expectedLabel: string
  actualLabel: string
}

const OUTCOME_MODE_INFO: Record<TestOutcomeMode, TestOutcomeModeInfo> = {
  pass: {
    label: "pass",
    summary: "Pinned outputs must match the run.",
    expectedLabel: "expected · pinned output",
    actualLabel: "actual · run output",
  },
  "step-failure": {
    label: "expected failure",
    summary: "A pinned step output must not match the run (comparison fails at that step).",
    expectedLabel: "expected · pinned output",
    actualLabel: "actual · run output",
  },
  "input-validation-error": {
    label: "input validation error",
    summary: "Input pairing must block the run before inference starts.",
    expectedLabel: "expected · upstream reference",
    actualLabel: "actual · pinned local input",
  },
  "run-error": {
    label: "expected run error",
    summary: "The pipeline run must end in error.",
    expectedLabel: "expected",
    actualLabel: "actual · run outcome",
  },
}

export function testOutcomeMode(expectFailure?: TestExpectFailure): TestOutcomeMode {
  if (!expectFailure) return "pass"
  if (expectFailure === "input-compat") return "input-validation-error"
  if (expectFailure === "run-error") return "run-error"
  return "step-failure"
}

export function testOutcomeModeInfo(mode: TestOutcomeMode): TestOutcomeModeInfo {
  return OUTCOME_MODE_INFO[mode]
}

export function expectFailureFromOutcomeMode(
  mode: TestOutcomeMode,
  step?: string,
): TestExpectFailure | undefined {
  if (mode === "pass") return undefined
  if (mode === "input-validation-error") return "input-compat"
  if (mode === "run-error") return "run-error"
  const trimmed = step?.trim()
  return trimmed ? { step: trimmed } : { step: "" }
}

export function testResultCompareLabels(
  expectFailure: TestExpectFailure | undefined,
  stepLabel: string,
): TestCompareColumnLabels {
  const mode = testOutcomeMode(expectFailure)
  if (mode === "input-validation-error" && stepLabel === "Input pairing") {
    return {
      expected: OUTCOME_MODE_INFO["input-validation-error"].expectedLabel,
      actual: OUTCOME_MODE_INFO["input-validation-error"].actualLabel,
    }
  }
  if (mode === "step-failure" && typeof expectFailure === "object" && "step" in expectFailure) {
    if (labelAsStateKey(stepLabel) === labelAsStateKey(expectFailure.step)) {
      return {
        expected: OUTCOME_MODE_INFO["step-failure"].expectedLabel,
        actual: OUTCOME_MODE_INFO["step-failure"].actualLabel,
      }
    }
  }
  if (mode === "pass") {
    return {
      expected: OUTCOME_MODE_INFO.pass.expectedLabel,
      actual: OUTCOME_MODE_INFO.pass.actualLabel,
    }
  }
  return { expected: "expected", actual: "actual" }
}

export type SpineTestFileExpect = {
  expectFailure?: TestExpectFailure
  inputs?: Record<string, string | string[]>
  expectedOutputs: Record<string, unknown>
}

export function parseExpectFailure(raw: unknown): TestExpectFailure | undefined {
  if (raw === "input-compat" || raw === "run-error") return raw
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as { step?: unknown; reason?: unknown }
    const step = typeof o.step === "string" ? o.step.trim() : ""
    if (!step) return undefined
    const reason = typeof o.reason === "string" ? o.reason.trim() : ""
    return reason ? { step, reason } : { step }
  }
  return undefined
}

export function serializeExpectFailure(ef: TestExpectFailure): TestExpectFailure {
  if (typeof ef === "object" && "step" in ef) {
    const reason = ef.reason?.trim()
    return reason ? { step: ef.step.trim(), reason } : { step: ef.step.trim() }
  }
  return ef
}

export function testExpectsInputCompatFailure(test: Pick<SpineTestFileExpect, "expectFailure">): boolean {
  return test.expectFailure === "input-compat"
}

export function testExpectsRunError(test: Pick<SpineTestFileExpect, "expectFailure">): boolean {
  return test.expectFailure === "run-error"
}

export function testExpectsStepFailure(test: Pick<SpineTestFileExpect, "expectFailure">): string | undefined {
  const ef = test.expectFailure
  return typeof ef === "object" && ef && "step" in ef ? ef.step : undefined
}

export function testExpectFailureReason(test: Pick<SpineTestFileExpect, "expectFailure">): string | undefined {
  const ef = test.expectFailure
  if (typeof ef === "object" && ef && "step" in ef) return ef.reason?.trim() || undefined
  return undefined
}

export function isExpectFailureTest(test: Pick<SpineTestFileExpect, "expectFailure">): boolean {
  return test.expectFailure !== undefined
}

export function evaluateInputCompatForTest(
  test: SpineTestFileExpect,
  modules: PipelineModule[],
  projectDocs: DocRef[],
  contentByDocId: Record<string, string>,
): InputCompatPairResult[] {
  const resolved = resolveNamedRunInputs(test.inputs ?? {}, modules, projectDocs)
  if (!resolved.ok) return []
  const inputModules = orderedInputModules(modules)
  return evaluateInputCompat(inputModules, resolved.assignment, contentByDocId)
}

export function inputCompatBlockedForTest(
  test: SpineTestFileExpect,
  modules: PipelineModule[],
  projectDocs: DocRef[],
  contentByDocId: Record<string, string>,
): boolean {
  return inputCompatHasMismatch(evaluateInputCompatForTest(test, modules, projectDocs, contentByDocId))
}

export function syntheticInputCompatResults(
  pairs: InputCompatPairResult[],
  blocked: boolean,
): TestStepResult[] {
  return [
    {
      label: "Input pairing",
      status: blocked ? RunTestStepStatus.Fail : RunTestStepStatus.Pass,
      skipReason: blocked
        ? "pairing mismatch — run blocked (expected for this test)"
        : "pairing matched — expected mismatch did not occur",
      expected: pairs.flatMap((p) =>
        p.keys.map((k) => `${k.label}: ${k.status}${k.upstreamValue ? ` (${k.upstreamValue})` : ""}`),
      ),
      actual: pairs.flatMap((p) =>
        p.keys.map((k) => `${k.label}: ${k.status}${k.localValue ? ` (${k.localValue})` : ""}`),
      ),
    },
  ]
}

export function testOutcomePassed(
  test: SpineTestFileExpect,
  results: TestStepResult[] | null,
  run: PipelineRun | null,
  inputCompatBlocked = false,
  normalVerdictPassed = false,
): boolean {
  const ef = test.expectFailure
  if (!ef) return normalVerdictPassed

  if (ef === "input-compat") return inputCompatBlocked

  if (ef === "run-error") return run?.status === "error"

  if (typeof ef === "object" && "step" in ef) {
    if (!results) return false
    const target = labelAsStateKey(ef.step)
    const fail = results.find(
      (r) =>
        r.status === RunTestStepStatus.Fail ||
        r.status === RunTestStepStatus.NotReached ||
        r.inputDescriptionCheck?.matches === false,
    )
    if (!fail) return false
    return labelAsStateKey(fail.label) === target
  }

  return false
}

export function loadTestInputContents(
  test: SpineTestFileExpect,
  modules: PipelineModule[],
  projectDocs: DocRef[],
  readContent: (docName: string) => string | undefined,
): Record<string, string> {
  const resolved = resolveNamedRunInputs(test.inputs ?? {}, modules, projectDocs)
  if (!resolved.ok) return {}
  const contentByDocId: Record<string, string> = {}
  for (const docs of Object.values(resolved.assignment)) {
    const list = Array.isArray(docs) ? docs : [docs]
    for (const doc of list) {
      if (!doc) continue
      const text = readContent(doc.name)
      if (text !== undefined) contentByDocId[doc.id] = text
    }
  }
  return contentByDocId
}

// AI : validate that a negative test will actually hit its expected failure mode.
export function verifyExpectFailurePrecondition(
  test: SpineTestFileExpect,
  project: Project,
  projectDocs: DocRef[],
  contentByDocId: Record<string, string>,
): { ok: boolean; message: string } | undefined {
  if (!test.expectFailure) return undefined

  if (test.expectFailure === "input-compat") {
    const blocked = inputCompatBlockedForTest(test, project.modules, projectDocs, contentByDocId)
    return blocked
      ? { ok: true, message: "inputs are incompatible — pairing will block the run" }
      : {
          ok: false,
          message: "expectFailure input-compat but selected inputs pair successfully — test will not pass",
        }
  }

  if (typeof test.expectFailure === "object" && "step" in test.expectFailure) {
    const stepKey = labelAsStateKey(test.expectFailure.step)
    const hasStep = Object.keys(test.expectedOutputs).some((k) => labelAsStateKey(k) === stepKey)
    if (!hasStep) {
      return {
        ok: false,
        message: `expectFailure step "${test.expectFailure.step}" must appear in expectedOutputs`,
      }
    }
    const reason = test.expectFailure.reason?.trim()
    const reasonNote = reason ? ` — ${reason}` : ""
    return {
      ok: true,
      message: `expects step "${test.expectFailure.step}" to fail comparison after run${reasonNote}`,
    }
  }

  return { ok: true, message: "expects pipeline run to end in error" }
}
