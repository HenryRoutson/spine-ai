"use client"

// AI : expected-vs-actual verdict list — shared by the Testing tab (live run) and
// AI : Logging (persisted run.test report), so the rendering exists exactly once.
// AI : TODO (spec) — confusion matrix / field group-by view for test failures (spec § testing).

import { useEffect, useState, type ReactNode } from "react"
import { Check, ChevronDown, ChevronRight, CircleCheck, CircleX, Copy, MinusCircle } from "lucide-react"
import { ExpectedActualCompare } from "@/components/expected-actual-compare"
import { JsonUnifiedDiffView } from "@/components/json-unified-diff-view"
import { JsonFieldKindHighlight, JsonFieldKindLegend } from "@/components/highlight"
import { SectionLabel } from "@/components/testing-editor"
import {
  readTestingCompareWidth,
  TESTING_COMPARE_MAX,
  TESTING_COMPARE_MIN,
  useTestingCompareWidth,
  writeTestingCompareWidth,
} from "@/lib/testing-settings"
import { firstFailure, probabilisticReferencePaths, diffExplanationMap, deterministicCompareCores } from "@/lib/testing-files"
import { testOutcomeModeInfo, testResultCompareLabels, type TestExpectFailure } from "@/lib/test-expect-failure"
import { formatTestFailuresForClipboard, testResultsHaveFailures } from "@/lib/test-error-copy"
import { copyTextToClipboard } from "@/lib/clipboard"
import { stablePrettyJson } from "@/lib/deep_equal"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { jsonUnifiedDiffSourceIndexes } from "@/lib/json-diff"
import { cn } from "@/lib/utils"
import {
  RunTestStepStatus,
  type PipelineRun,
  type RunTestProbabilisticResult,
  type RunTestStepResult,
} from "@/lib/types"
import { StepInputDescription } from "@/components/step-input-description"

function negativeTestSummary(expectFailure: TestExpectFailure, passed: boolean): string {
  if (expectFailure === "input-compat") {
    return passed
      ? "input pairing blocked as expected — negative test passed"
      : "inputs paired successfully — expected mismatch did not occur"
  }
  if (expectFailure === "run-error") {
    return passed ? "pipeline errored as expected — negative test passed" : "pipeline completed — expected run error did not occur"
  }
  if (typeof expectFailure === "object" && "step" in expectFailure) {
    const reason = expectFailure.reason?.trim()
    const reasonNote = reason ? ` (${reason})` : ""
    return passed
      ? `step "${expectFailure.step}" failed as expected${reasonNote} — negative test passed`
      : `step "${expectFailure.step}" did not fail${reasonNote} — negative test failed`
  }
  return passed ? "negative test passed" : "negative test failed"
}

export function TestResults({
  results,
  verdictPassed,
  expectFailure,
  action,
  testDocName,
  run,
  runError,
}: {
  results: RunTestStepResult[]
  verdictPassed?: boolean
  expectFailure?: TestExpectFailure
  action?: ReactNode
  testDocName?: string
  run?: PipelineRun | null
  runError?: string | null
}) {
  const [errorsCopied, setErrorsCopied] = useState(false)
  const failure = firstFailure(results)
  const passed = verdictPassed ?? !failure
  const showCopyErrors = testResultsHaveFailures(results) || !!runError?.trim()
  const stepPassCount = results.filter((r) => r.status === RunTestStepStatus.Pass).length
  // AI : skipped steps (input/combine) are recorded but never scored — out of the score.
  const skipped = results.filter((r) => r.status === RunTestStepStatus.Skipped).length
  const compared = results.length - skipped
  const llmChecked = results.filter((r) => r.llmEvaluated).length
  const skippedNote =
    (skipped ? ` · ${skipped} step(s) skipped` : "") +
    (llmChecked ? ` · ${llmChecked} step(s) LLM-checked (probabilistic fields)` : "")
  const summary = expectFailure
    ? negativeTestSummary(expectFailure, passed)
    : failure
      ? `${stepPassCount}/${compared} steps match — pipeline diverges at "${failure.label}"${skippedNote}`
      : `all ${compared} expected outputs match${skippedNote}`
  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>results</SectionLabel>
        <div className="flex shrink-0 items-center gap-2">
          {showCopyErrors && (
            <button
              type="button"
              onClick={() => {
                void copyTextToClipboard(
                  formatTestFailuresForClipboard(results, { testDocName, run, runError }),
                )
                setErrorsCopied(true)
                setTimeout(() => setErrorsCopied(false), COPY_FEEDBACK_MS)
              }}
              className="inline-flex items-center gap-1 font-mono text-[10px] text-destructive hover:text-destructive/80"
              title="Copy failed fields (input, process, output, expected)"
            >
              {errorsCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {errorsCopied ? "copied" : "copy errors"}
            </button>
          )}
          {action}
        </div>
      </div>
      <p
        className={cn(
          "mt-1.5 flex items-center gap-1.5 rounded border p-2 font-mono text-[11px]",
          passed
            ? "border-chart-2/30 bg-chart-2/10 text-chart-2"
            : "border-destructive/30 bg-destructive/10 text-destructive",
        )}
      >
        {passed ? <CircleCheck className="h-3.5 w-3.5 shrink-0" /> : <CircleX className="h-3.5 w-3.5 shrink-0" />}
        {summary}
      </p>
      <ul className="mt-2 space-y-1.5">
        {results.map((r) => (
          <StepResultRow
            key={r.label}
            result={r}
            isFirstFailure={!expectFailure && failure?.label === r.label}
            expectFailure={expectFailure}
          />
        ))}
      </ul>
    </section>
  )
}

function StepResultRow({
  result,
  isFirstFailure,
  expectFailure,
}: {
  result: RunTestStepResult
  isFirstFailure: boolean
  expectFailure?: TestExpectFailure
}) {
  const [open, setOpen] = useState(isFirstFailure)
  const savedCompareWidth = useTestingCompareWidth()
  const [compareWidth, setCompareWidth] = useState(readTestingCompareWidth)
  useEffect(() => setCompareWidth(savedCompareWidth), [savedCompareWidth])
  const inputCheckFailed = result.inputDescriptionCheck?.matches === false
  const expectedNegativeRow =
    expectFailure === "input-compat" && result.label === "Input pairing"
  const failed =
    !expectedNegativeRow &&
    (result.status === RunTestStepStatus.Fail ||
      result.status === RunTestStepStatus.NotReached ||
      inputCheckFailed)
  const probabilisticCheckedPaths =
    result.expected !== undefined && result.ignoredPaths?.length
      ? probabilisticReferencePaths(result.expected, result.ignoredPaths)
      : undefined
  const diffExplanations = diffExplanationMap(result.deterministicDiffExplanations)
  const deterministicCores =
    result.expected !== undefined && result.actual !== undefined
      ? deterministicCompareCores(result.expected, result.actual, result.ignoredPaths)
      : undefined
  const expectedCorePretty =
    deterministicCores ? stablePrettyJson(deterministicCores.expectedCore) : undefined
  const actualCorePretty =
    deterministicCores ? stablePrettyJson(deterministicCores.actualCore) : undefined
  const diffSourceIndexes =
    deterministicCores
      ? jsonUnifiedDiffSourceIndexes(deterministicCores.expectedCore, deterministicCores.actualCore)
      : undefined
  const compareLabels = testResultCompareLabels(expectFailure, result.label)
  return (
    <li
      className={cn(
        "rounded-md border",
        expectedNegativeRow
          ? "border-yellow-500/40"
          : failed
            ? "border-destructive/40"
            : "border-border",
        isFirstFailure && "ring-1 ring-destructive/40",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        {result.status === RunTestStepStatus.Pass ? (
          <CircleCheck className="h-3.5 w-3.5 shrink-0 text-chart-2" />
        ) : result.status === RunTestStepStatus.Fail ? (
          <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" />
        ) : (
          <MinusCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{result.label}</span>
        {result.status === RunTestStepStatus.Fail && result.diffPath && (
          <span className="shrink-0 font-mono text-[10px] text-destructive">first diff at {result.diffPath}</span>
        )}
        {result.status === RunTestStepStatus.NotReached && (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">step produced no output</span>
        )}
        {result.status === RunTestStepStatus.Skipped && (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {inputCheckFailed ? "input check failed" : (result.skipReason ?? "skipped")}
          </span>
        )}
        {inputCheckFailed && result.status === RunTestStepStatus.Fail && (
          <span className="shrink-0 font-mono text-[10px] text-destructive">input check failed</span>
        )}
        {result.llmEvaluated && !!result.probabilisticResults?.length && (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {result.probabilisticResults.filter((x) => x.pass).length}/{result.probabilisticResults.length} probabilistic
          </span>
        )}
      </button>
      {open && result.inputDescriptionCheck && (
        <div className="border-t border-border px-2.5 py-2">
          <StepInputDescription check={result.inputDescriptionCheck} forceVisible />
        </div>
      )}
      {open && result.deterministicDiff && (
        <div className="border-t border-border px-2.5 py-2">
          <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">deterministic diff</p>
          <div className="max-h-48 overflow-auto rounded border border-border bg-secondary/30 p-2">
            <JsonUnifiedDiffView
              diff={result.deterministicDiff}
              diffExplanations={diffExplanations}
              expectedPretty={expectedCorePretty}
              actualPretty={actualCorePretty}
              diffSourceIndexes={diffSourceIndexes}
            />
          </div>
        </div>
      )}
      {open && !!result.probabilisticResults?.length && (
        <div className="border-t border-border px-2.5 py-2">
          <p className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">
            LLM semantic checks · {result.probabilisticResults.filter((x) => x.pass).length}/
            {result.probabilisticResults.length} pass
          </p>
          <ul className="space-y-2">
            {result.probabilisticResults.map((pr) => (
              <ProbabilisticFieldCheck key={pr.path} result={pr} />
            ))}
          </ul>
        </div>
      )}
      {open && (result.expected !== undefined || result.actual !== undefined) && (
        <div className="space-y-2 border-t border-border p-2.5">
          {expectedNegativeRow && (
            <p className="font-mono text-[10px] text-yellow-700 dark:text-yellow-500">
              {testOutcomeModeInfo("input-validation-error").summary}
            </p>
          )}
          {!expectedNegativeRow && <JsonFieldKindLegend />}
          {result.expected !== undefined && result.actual !== undefined ? (
            <ExpectedActualCompare
              expectedJson={stablePrettyJson(result.expected)}
              actual={result.actual}
              probabilisticPaths={result.ignoredPaths ?? []}
              probabilisticCheckedPaths={probabilisticCheckedPaths}
              tolerantPaths={result.tolerantPaths ?? []}
              deterministicDiffExplanations={result.deterministicDiffExplanations}
              expectedLabel={compareLabels.expected}
              actualLabel={compareLabels.actual}
              compareWidth={compareWidth}
              onCompareWidthChange={setCompareWidth}
              onCompareWidthCommit={writeTestingCompareWidth}
              minLeading={TESTING_COMPARE_MIN}
              maxLeading={TESTING_COMPARE_MAX}
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {result.expected !== undefined && (
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">{compareLabels.expected}</p>
                  <div className="max-h-72 overflow-auto rounded border border-border bg-secondary/30 p-2">
                    <JsonFieldKindHighlight
                      json={stablePrettyJson(result.expected)}
                      probabilisticPaths={result.ignoredPaths ?? []}
                      probabilisticCheckedPaths={probabilisticCheckedPaths}
                      tolerantPaths={result.tolerantPaths ?? []}
                    />
                  </div>
                </div>
              )}
              <div className={result.expected === undefined ? "lg:col-span-2" : ""}>
                <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">{compareLabels.actual}</p>
                <div className="max-h-72 overflow-auto rounded border border-border bg-secondary/30 p-2">
                  {result.actual === undefined ? (
                    <p className="font-mono text-[11px] text-muted-foreground">— no output —</p>
                  ) : (
                    <JsonFieldKindHighlight
                      json={stablePrettyJson(result.actual)}
                      probabilisticPaths={result.ignoredPaths ?? []}
                      probabilisticCheckedPaths={probabilisticCheckedPaths}
                      tolerantPaths={result.tolerantPaths ?? []}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function ProbabilisticFieldCheck({ result }: { result: RunTestProbabilisticResult }) {
  const showValues = result.expected !== undefined || result.actual !== undefined
  return (
    <li
      className={cn(
        "rounded border p-2",
        result.pass ? "border-chart-2/30 bg-chart-2/5" : "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-start gap-1.5">
        {result.pass ? (
          <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-chart-2" />
        ) : (
          <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-foreground">{result.path}</span>
            <span
              className={cn(
                "rounded-sm px-1.5 py-0.5 font-mono text-[9px] uppercase",
                result.pass ? "bg-chart-3/15 text-chart-3" : "bg-destructive/15 text-destructive",
              )}
            >
              ≈ LLM
            </span>
          </div>
          {!result.pass && result.reason && (
            <p className="mt-1 font-mono text-[10px] text-destructive">{result.reason}</p>
          )}
          {showValues && (
            <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
              {result.expected !== undefined && (
                <div>
                  <p className="mb-1 font-mono text-[9px] uppercase text-muted-foreground">expected reference</p>
                  <pre className="max-h-24 overflow-auto rounded border border-border bg-secondary/30 p-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                    {stablePrettyJson(result.expected)}
                  </pre>
                </div>
              )}
              <div className={result.expected === undefined ? "lg:col-span-2" : ""}>
                <p className="mb-1 font-mono text-[9px] uppercase text-muted-foreground">actual</p>
                <pre
                  className={cn(
                    "max-h-24 overflow-auto rounded border p-1.5 font-mono text-[10px] leading-relaxed",
                    result.pass
                      ? "border-chart-2/30 bg-chart-2/10 text-muted-foreground"
                      : "border-destructive/30 bg-destructive/10 text-destructive",
                  )}
                >
                  {result.actual === undefined ? "— missing —" : stablePrettyJson(result.actual)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
