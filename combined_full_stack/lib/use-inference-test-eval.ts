"use client"

// AI : when inference loads inputs from a *_testing.json preset, compare the finished run
// AI : against that file's expectedOutputs (same path as the Testing tab).

import { useEffect, useState } from "react"
import { evaluateTestReport } from "@/lib/testing-evaluate"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
import { parseTestFile, testContentSig, testPipelineSig, type TestStepResult } from "@/lib/testing-files"
import type { DocId, ModelId, PipelineModule, PipelineRun, Project, RunTestReport, StructureModel, TypeAlias } from "@/lib/types"
import type { InferencePhase } from "@/lib/use-inference-run-progress"

type LinkedTest = { docId: DocId; docName: string }

type Args = {
  phase: InferencePhase
  run: PipelineRun | null
  linkedTest: LinkedTest | null
  project: Pick<Project, "modules" | "models" | "typeAliases">
  modules: PipelineModule[]
  models: StructureModel[]
  typeAliases: TypeAlias[]
  model: ModelId
  updateRunTest: (runId: PipelineRun["id"], test: RunTestReport) => Promise<void>
  refreshBilling: () => Promise<void>
}

export function useInferenceTestEval({
  phase,
  run,
  linkedTest,
  project,
  modules,
  models,
  typeAliases,
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
        const content = docTextContent(data)
        const parsed = parseTestFile(content)
        if (!parsed.ok) {
          if (!cancelled) setError(parsed.error)
          return
        }
        const hasExpected = Object.values(parsed.test.expectedOutputs).some((v) => v !== null)
        if (!hasExpected) return

        const report = await evaluateTestReport(run, parsed.test, project, model)
        if (cancelled) return
        setResults(report)
        updateRunTest(run.id, {
          testDocName: linkedTest.docName,
          results: report,
          testContentSig: testContentSig(content),
          pipelineSig: testPipelineSig(project as Project, model, { modules, models, typeAliases }),
        }).catch(console.error)
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
  }, [phase, run?.id, linkedTest?.docId, linkedTest?.docName, project, modules, models, typeAliases, model, updateRunTest, refreshBilling])

  return { testResults: results, testEvaluating: evaluating, testEvalError: error }
}
