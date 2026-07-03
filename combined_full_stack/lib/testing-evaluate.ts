// AI : full test verdict — deterministic JSON compare, then LLM check for probabilistic fields.

import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import {
  compareRunToTest,
  mergeProbabilisticEvaluations,
  probabilisticEvalPayloads,
  type ProbabilisticEvalResult,
  type SpineTestFile,
  type TestStepResult,
} from "@/lib/testing-files"
import type { ModelId, PipelineRun, Project } from "@/lib/types"

export async function evaluateTestReport(
  run: PipelineRun,
  test: SpineTestFile,
  project: Pick<Project, "modules" | "models">,
  model: ModelId,
): Promise<TestStepResult[]> {
  let report = compareRunToTest(run, test, project)
  const payloads = probabilisticEvalPayloads(run, test, report, project)
  if (!payloads.length) return report
  const { results: probabilisticResults } = await apiJson<{ results: ProbabilisticEvalResult[] }>(
    API_ROUTES.testingEvaluate,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ steps: payloads, model }),
    },
  )
  return mergeProbabilisticEvaluations(report, probabilisticResults)
}
