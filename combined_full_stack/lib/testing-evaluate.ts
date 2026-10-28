// AI : full test verdict — deterministic JSON compare, then LLM check for probabilistic fields.

import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import {
  compareRunToTest,
  deterministicDiffEvalPayloads,
  mergeDeterministicDiffExplanations,
  mergeInputDescriptionChecks,
  mergeProbabilisticEvaluations,
  probabilisticEvalPayloads,
  type DeterministicDiffEvalResult,
  type ProbabilisticEvalResult,
  type SpineTestFile,
  type TestStepResult,
} from "@/lib/testing-files"
import type { ModelId, PipelineRun, Project } from "@/lib/types"

export async function evaluateTestReport(
  run: PipelineRun,
  test: SpineTestFile,
  project: Pick<Project, "id" | "modules" | "models">,
  model: ModelId,
): Promise<TestStepResult[]> {
  let report = compareRunToTest(run, test, project)
  report = mergeInputDescriptionChecks(run, report, project)
  const probabilisticPayloads = probabilisticEvalPayloads(run, test, report, project)
  const diffPayloads = deterministicDiffEvalPayloads(report)
  if (!probabilisticPayloads.length && !diffPayloads.length) return report
  const { results: probabilisticResults, diffResults } = await apiJson<{
    results: ProbabilisticEvalResult[]
    diffResults: DeterministicDiffEvalResult[]
  }>(API_ROUTES.testingEvaluate, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      steps: probabilisticPayloads.length ? probabilisticPayloads : undefined,
      diffSteps: diffPayloads.length ? diffPayloads : undefined,
      model,
      projectId: project.id,
    }),
  })
  report = mergeProbabilisticEvaluations(report, probabilisticResults ?? [])
  return mergeDeterministicDiffExplanations(report, diffResults ?? [])
}
