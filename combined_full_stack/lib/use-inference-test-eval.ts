"use client"

// AI : when inference loads inputs from a *_testing.json preset, compare the finished run
// AI : against that file's expectedOutputs (same path as the Testing tab).

import { useEffect, useState } from "react"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
import { evaluateTestReport } from "@/lib/testing-evaluate"
import { parseTestFile, type TestStepResult } from "@/lib/testing-files"
import type { DocId, ModelId, PipelineRun, Project, RunTestReport } from "@/lib/types"
import type { InferencePhase } from "@/lib/use-inference-run-progress"

type LinkedTest = { docId: DocId; docName: string }

type Args = {
  phase: InferencePhase
  run: PipelineRun | null
  linkedTest: LinkedTest | null
  project: Pick<Project, "modules" | "models">
  model: ModelId
  updateRunTest: (runId: PipelineRun["id"], test: RunTestReport) => Promise<void>
  refreshBilling: () => Promise<void>
}

export function useInferenceTestEval({
  phase,
  run,
  linkedTest,
  project,
  model,
  updateRunTest,
  refreshBilling,
}: Args) {
  const [results, setResults] = useState<TestStepResult[] | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (phase !== "done" || !run || !linkedTest) {
      if (phase !== "done" || !linkedTest) {
        setResults(null)
        setEvaluating(false)
        setError(null)
      }
      return
    }

    let cancelled = false
    void (async () => {
      setEvaluating(true)
      setError(null)
      setResults(null)
      try {
        const data = await fetchDocText(linkedTest.docId)
        const parsed = parseTestFile(docTextContent(data))
        if (!parsed.ok) {
          if (!cancelled) setError(parsed.error)
          return
        }
        const hasExpected = Object.values(parsed.test.expectedOutputs).some((v) => v !== null)
        if (!hasExpected) return

        const report = await evaluateTestReport(run, parsed.test, project, model)
        if (cancelled) return
        setResults(report)
        updateRunTest(run.id, { testDocName: linkedTest.docName, results: report }).catch(console.error)
        refreshBilling().catch(console.error)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setEvaluating(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [phase, run?.id, linkedTest?.docId, linkedTest?.docName, project, model, updateRunTest, refreshBilling])

  return { testResults: results, testEvaluating: evaluating, testEvalError: error }
}
