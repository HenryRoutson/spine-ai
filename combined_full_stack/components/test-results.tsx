"use client"

// AI : expected-vs-actual verdict list — shared by the Testing tab (live run) and
// AI : Logging (persisted run.test report), so the rendering exists exactly once.

import { useState, type ReactNode } from "react"
import { ChevronDown, ChevronRight, CircleCheck, CircleX, MinusCircle } from "lucide-react"
import { JsonFieldKindHighlight, JsonFieldKindLegend } from "@/components/highlight"
import { SectionLabel } from "@/components/testing-editor"
import { firstFailure, probabilisticReferencePaths } from "@/lib/testing-files"
import { cn } from "@/lib/utils"
import { RunTestStepStatus, type RunTestProbabilisticResult, type RunTestStepResult } from "@/lib/types"
import { StepInputDescription } from "@/components/step-input-description"

export function TestResults({ results, action }: { results: RunTestStepResult[]; action?: ReactNode }) {
  const failure = firstFailure(results)
  const passed = results.filter((r) => r.status === RunTestStepStatus.Pass).length
  // AI : skipped steps (input/combine) are recorded but never scored — out of the score.
  const skipped = results.filter((r) => r.status === RunTestStepStatus.Skipped).length
  const compared = results.length - skipped
  const llmChecked = results.filter((r) => r.llmEvaluated).length
  const skippedNote =
    (skipped ? ` · ${skipped} step(s) skipped` : "") +
    (llmChecked ? ` · ${llmChecked} step(s) LLM-checked (probabilistic fields)` : "")
  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>results</SectionLabel>
        {action}
      </div>
      <p
        className={cn(
          "mt-1.5 flex items-center gap-1.5 rounded border p-2 font-mono text-[11px]",
          failure
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-chart-2/30 bg-chart-2/10 text-chart-2",
        )}
      >
        {failure ? <CircleX className="h-3.5 w-3.5 shrink-0" /> : <CircleCheck className="h-3.5 w-3.5 shrink-0" />}
        {failure
          ? `${passed}/${compared} steps match — pipeline diverges at "${failure.label}"${skippedNote}`
          : `all ${compared} expected outputs match${skippedNote}`}
      </p>
      <ul className="mt-2 space-y-1.5">
        {results.map((r) => (
          <StepResultRow key={r.label} result={r} isFirstFailure={failure?.label === r.label} />
        ))}
      </ul>
    </section>
  )
}

function StepResultRow({ result, isFirstFailure }: { result: RunTestStepResult; isFirstFailure: boolean }) {
  const [open, setOpen] = useState(isFirstFailure)
  const inputCheckFailed = result.inputDescriptionCheck?.matches === false
  const failed =
    result.status === RunTestStepStatus.Fail ||
    result.status === RunTestStepStatus.NotReached ||
    inputCheckFailed
  const probabilisticCheckedPaths =
    result.expected !== undefined && result.ignoredPaths?.length
      ? probabilisticReferencePaths(result.expected, result.ignoredPaths)
      : undefined
  return (
    <li
      className={cn(
        "rounded-md border",
        failed ? "border-destructive/40" : "border-border",
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
          <pre className="max-h-48 overflow-auto rounded border border-border bg-secondary/30 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {result.deterministicDiff}
          </pre>
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
          <JsonFieldKindLegend />
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {result.expected !== undefined && (
              <div>
                <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">expected</p>
                <div className="max-h-72 overflow-auto rounded border border-border bg-secondary/30 p-2">
                  <JsonFieldKindHighlight
                    json={JSON.stringify(result.expected, null, 2)}
                    probabilisticPaths={result.ignoredPaths ?? []}
                    probabilisticCheckedPaths={probabilisticCheckedPaths}
                  />
                </div>
              </div>
            )}
            <div className={result.expected === undefined ? "lg:col-span-2" : ""}>
              <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">actual</p>
              <div className="max-h-72 overflow-auto rounded border border-border bg-secondary/30 p-2">
                {result.actual === undefined ? (
                  <p className="font-mono text-[11px] text-muted-foreground">— no output —</p>
                ) : (
                  <JsonFieldKindHighlight
                    json={JSON.stringify(result.actual, null, 2)}
                    probabilisticPaths={result.ignoredPaths ?? []}
                    probabilisticCheckedPaths={probabilisticCheckedPaths}
                  />
                )}
              </div>
            </div>
          </div>
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
                    {JSON.stringify(result.expected, null, 2)}
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
                  {result.actual === undefined ? "— missing —" : JSON.stringify(result.actual, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
