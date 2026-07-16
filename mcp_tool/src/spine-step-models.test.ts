import "./bootstrap-env.js"
import { describe, expect, it } from "vitest"
import {
  deriveStepPrompt,
  describePipelineSteps,
  exportPydanticProject,
  validatePipelineWiring,
  validateStepOutputValue,
} from "./spine-step-models.js"

const SEED = "combined_full_stack/seeds/homework_grader.json"
const REPO = process.env.SPINE_REPO_ROOT!

describe("spine-step-models", () => {
  it("describes every pipeline step with pydantic + schema metadata", () => {
    const report = describePipelineSteps({ projectSeedPath: SEED }, REPO)
    expect(report.stepCount).toBeGreaterThan(5)
    expect(report.pipelineStateSummary).toContain("Final Output")
    const llmStep = report.steps.find((s) => s.kind === "llm-batch" && s.derivedStructuredPrompt)
    expect(llmStep?.pydanticModel).toContain("BaseModel")
    expect(llmStep?.derivedStructuredPrompt).toContain("JSON Schema")
    expect(llmStep?.jsonSchema).toBeTruthy()
  })

  it("filters to a single step by label", () => {
    const report = describePipelineSteps(
      { projectSeedPath: SEED, stepLabel: "Final Output" },
      REPO,
    )
    expect(report.steps).toHaveLength(1)
    expect(report.steps[0]!.label).toBe("Final Output")
  })

  it("validates pipeline wiring for homework grader", () => {
    const report = validatePipelineWiring({ projectSeedPath: SEED }, REPO)
    expect(report.ok).toBe(true)
  })

  it("derives a structured prompt for an LLM step", () => {
    const steps = describePipelineSteps({ projectSeedPath: SEED }, REPO)
    const llm = steps.steps.find((s) => s.kind === "llm-batch")
    expect(llm).toBeTruthy()
    const prompt = deriveStepPrompt({ projectSeedPath: SEED, stepLabel: llm!.label }, REPO)
    expect(prompt.derivedStructuredPrompt).toContain("JSON Schema")
    expect(prompt.pydanticModel).toContain("BaseModel")
  })

  it("exports pydantic models for the project", () => {
    const out = exportPydanticProject({ projectSeedPath: SEED }, REPO)
    expect(out.modelsPy).toContain("BaseModel")
    expect(out.pipelineSignatures?.pipelinePy).toContain("PipelineState")
  })

  it("rejects invalid step output JSON against schema", () => {
    const result = validateStepOutputValue(
      {
        projectSeedPath: SEED,
        stepLabel: "Final Output",
        valueJson: JSON.stringify({ not: "a valid grade row list" }),
      },
      REPO,
    )
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
