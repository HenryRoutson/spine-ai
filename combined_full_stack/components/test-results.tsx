"use client"

// AI : expected-vs-actual verdict list — shared by the Testing tab (live run) and
// AI : Logging (persisted run.test report), so the rendering exists exactly once.

import { useState, type ReactNode } from "react"
import { ChevronDown, ChevronRight, CircleCheck, CircleX, MinusCircle } from "lucide-react"
import { JsonHighlight } from "@/components/highlight"
import { SectionLabel } from "@/components/testing-editor"
import { firstFailure } from "@/lib/testing-files"
import { cn } from "@/lib/utils"
import type { RunTestStepResult } from "@/lib/types"

export function TestResults({ results, action }: { results: RunTestStepResult[]; action?: ReactNode }) {
  const failure = firstFailure(results)
  const passed = results.filter((r) => r.status === "pass").length
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
          ? `${passed}/${results.length} steps match — pipeline diverges at "${failure.label}"`
          : `all ${results.length} expected outputs match`}
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
  const failed = result.status !== "pass"
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
        {result.status === "pass" ? (
          <CircleCheck className="h-3.5 w-3.5 shrink-0 text-chart-2" />
        ) : result.status === "fail" ? (
          <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" />
        ) : (
          <MinusCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{result.label}</span>
        {result.status === "fail" && result.diffPath && (
          <span className="shrink-0 font-mono text-[10px] text-destructive">first diff at {result.diffPath}</span>
        )}
        {result.status === "not-reached" && (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">step produced no output</span>
        )}
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-2 border-t border-border p-2.5 lg:grid-cols-2">
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">expected</p>
            <div className="max-h-72 overflow-auto rounded border border-border bg-secondary/30 p-2">
              <JsonHighlight json={JSON.stringify(result.expected, null, 2)} />
            </div>
          </div>
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">actual</p>
            <div className="max-h-72 overflow-auto rounded border border-border bg-secondary/30 p-2">
              {result.actual === undefined ? (
                <p className="font-mono text-[11px] text-muted-foreground">— no output —</p>
              ) : (
                <JsonHighlight json={JSON.stringify(result.actual, null, 2)} />
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  )
}
