import { describe, expect, it } from "vitest"
import { createSpineSession } from "@/lib/core/session"
import { DEFAULT_MODEL } from "@/lib/types"
import { runVibeWorkspaceChecks } from "@/lib/server/pipeline_assistant"
import {
  buildVibeTopologyPromptBlock,
  formatTopologyRetryErrors,
  parseThinkingTopology,
  topologyAdvice,
} from "@/lib/server/vibe-coding-topology"
import type { VibeWorkspaceDraft } from "@/lib/server/vibe-coding-workspace"

function draft(modules: unknown[], models: unknown[]): VibeWorkspaceDraft {
  return {
    message: "I'll add this pipeline.",
    modules,
    models,
    typeAliases: null,
    docs: null,
    documentationUpdate: null,
    projectNameUpdate: null,
    targetFunctionName: null,
    proposedActions: null,
    errors: [],
  }
}

const receiptRow = {
  name: "ReceiptRow",
  description: "row",
  fields: [{ name: "vendor", type: "text", optional: false, description: "vendor" }],
}

describe("vibe topology cheat-sheet", () => {
  it("requires TOPOLOGY: as the first thinking line", () => {
    expect(parseThinkingTopology("TOPOLOGY: assemble\nthen zip resumes")).toBe("assemble")
    expect(parseThinkingTopology("  TOPOLOGY: llm-batch")).toBeNull()
    expect(buildVibeTopologyPromptBlock()).toMatch(/TOPOLOGY: <name>/)
    expect(buildVibeTopologyPromptBlock()).not.toMatch(/receipts \/ merchant/i)
    expect(buildVibeTopologyPromptBlock()).not.toMatch(/hundreds of unstructured/i)
  })

  it("scores known A/B example prompts without injecting them into live retries", () => {
    expect(topologyAdvice("Extract merchant and date from receipts with quotes; amount as a number", ["llm"])).toEqual(
      expect.arrayContaining([expect.stringMatching(/llm-batch/)]),
    )
    expect(
      topologyAdvice("Each meeting note has several action items — one spreadsheet row per item", ["llm-batch"]),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/flatten/)]))
    expect(topologyAdvice("Check expense line items against a policy table", ["fork", "llm"])).toEqual(
      expect.arrayContaining([expect.stringMatching(/combine/)]),
    )
    expect(topologyAdvice("Check expense line items against a policy table", ["combine", "llm"])).toEqual(
      expect.arrayContaining([expect.stringMatching(/custom-code/)]),
    )
    expect(topologyAdvice("Many resumes plus one job description → spreadsheet of skill matches", ["combine", "llm"])).toEqual(
      expect.arrayContaining([expect.stringMatching(/assemble/)]),
    )
    expect(
      topologyAdvice("Many resumes plus one job description → spreadsheet of skill matches", ["assemble", "llm-batch"]),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/flatten/)]))
    expect(
      topologyAdvice("From one contract extract risks, parties, and dates independently, then write a memo", ["llm"]),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/fork/)]))
    expect(formatTopologyRetryErrors("Convert hundreds of unstructured receipts into a single Excel file", ["llm"])).toBe(
      "",
    )
  })

  it("PASS I/O-valid pipelines even when the task text matches a few-shot example", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const report = runVibeWorkspaceChecks(
      draft(
        [
          {
            kind: "input",
            label: "Receipts",
            note: "one file",
            structureOut: "Document",
            inputType: "text",
            inputDescription: "receipt",
          },
          {
            kind: "llm",
            label: "Extract",
            note: "one row",
            structureIn: "Document",
            structureOut: "ReceiptRow",
            prompt: "Extract vendor.",
            inputDescription: "receipt",
          },
          {
            kind: "output",
            label: "Rows",
            structureIn: "ReceiptRow",
            structureOut: "ReceiptRow",
            inputDescription: "rows",
          },
        ],
        [receiptRow],
      ),
      session.project!,
      DEFAULT_MODEL,
      [],
      "Convert hundreds of unstructured receipts into a single Excel file",
    )
    expect(report).toMatch(/^PASS/m)
    expect(report).not.toMatch(/FAIL topology/)
  })
})
