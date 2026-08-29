import { describe, expect, it } from "vitest"
import { createSpineSession } from "@/lib/core/session"
import { DEFAULT_MODEL } from "@/lib/types"
import { runVibeWorkspaceChecks } from "@/lib/server/pipeline_assistant"
import { buildVibeTopologyPromptBlock, parseThinkingTopology } from "@/lib/server/vibe-coding-topology"
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

describe("vibe topology prompt", () => {
  it("requires TOPOLOGY: as the first thinking line", () => {
    expect(parseThinkingTopology("TOPOLOGY: assemble\nthen zip resumes")).toBe("assemble")
    expect(parseThinkingTopology("  TOPOLOGY: llm-batch")).toBeNull()
    expect(buildVibeTopologyPromptBlock()).toMatch(/TOPOLOGY: <name>/)
    expect(buildVibeTopologyPromptBlock()).not.toMatch(/hundreds of unstructured receipts/)
    expect(buildVibeTopologyPromptBlock()).not.toMatch(/risks, parties, and dates/)
  })

  it("PASS when I/O is valid — does not fail from task phrasing", () => {
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
