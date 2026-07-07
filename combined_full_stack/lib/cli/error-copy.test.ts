import { describe, expect, it } from "vitest"
import { formatErrorForClipboard } from "@/lib/error-copy"
import {
  collectInferenceInputIssues,
  inferenceInputIssueClipboard,
  inferenceInputIssueMessage,
  validateInferenceDocContent,
} from "@/lib/inference-validity"
import { InputType, type DocRef, type PipelineModule } from "@/lib/types"

describe("error-copy", () => {
  it("includes UI location, context, and stack in clipboard payload", () => {
    const text = formatErrorForClipboard({
      uiLocation: "Inference → Run Pipeline → input validation",
      summary: "invalid JSON (document is empty): Unexpected end of JSON input",
      context: {
        "Input step": "Marking Schema",
        Document: "homework_marking_schema_first_grade.json",
        "Content length (bytes)": "0",
      },
      stack: "SyntaxError: Unexpected end of JSON input\n    at JSON.parse",
    })
    expect(text).toContain("UI location: Inference → Run Pipeline → input validation")
    expect(text).toContain("Input step: Marking Schema")
    expect(text).toContain("Stack trace:")
    expect(text).toContain("Unexpected end of JSON input")
  })
})

describe("inference JSON validation errors", () => {
  const schemaModule = {
    id: "mod_in_schema",
    kind: "input",
    label: "Marking Schema",
    inputType: InputType.Json,
  } as PipelineModule

  const doc = {
    id: "doc_1",
    name: "homework_marking_schema_first_grade.json",
    type: InputType.Json,
  } as DocRef

  it("captures stack and empty-doc hint for invalid JSON", () => {
    const issue = validateInferenceDocContent(schemaModule, doc, "")
    expect(issue?.message).toMatch(/invalid JSON \(document is empty\)/)
    expect(issue?.stack).toMatch(/Unexpected end of JSON input/i)
    expect(issue?.contentLength).toBe(0)
  })

  it("formats clipboard payload with UI location", () => {
    const issues = collectInferenceInputIssues(
      [schemaModule],
      {},
      { doc_1: "" },
      { mod_in_schema: doc },
    )
    const clip = inferenceInputIssueClipboard(
      issues,
      "Inference → Run Pipeline → input validation",
      [schemaModule],
    )
    expect(inferenceInputIssueMessage(issues, [schemaModule])).toContain("Marking Schema")
    expect(clip).toContain("UI location: Inference → Run Pipeline → input validation")
    expect(clip).toContain("Stack trace:")
  })
})
