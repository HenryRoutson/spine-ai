// AI : every few-shot example must parse, materialize, and stay I/O-valid — that is the reliability floor.
import { describe, expect, it } from "vitest"
import { createSpineSession } from "@/lib/core/session"
import { DEFAULT_MODEL } from "@/lib/types"
import { materializeProposal } from "@/lib/server/pipeline_assistant"
import { formatPipelineValidationErrors } from "@/lib/server/validity"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import {
  matchVibeExample,
  parseFewShotVibeExamples,
  seedHarnessWriteTools,
  vibeExampleTasks,
} from "@/lib/server/vibe-coding-examples"

describe("vibe few-shot example catalog", () => {
  it("parses all seven few-shot examples", () => {
    const parsed = parseFewShotVibeExamples()
    expect(parsed.map((e) => e.id)).toEqual(["ex1", "ex1b", "ex1c", "ex2", "ex3", "ex4", "ex5"])
    expect(matchVibeExample("Convert hundreds of unstructured receipts into a single Excel file")?.id).toBe("ex1")
    expect(matchVibeExample("From one contract extract risks, parties, and dates independently, then write a memo")?.id).toBe(
      "ex5",
    )
  })

  for (const ex of vibeExampleTasks()) {
    it(`${ex.id} few-shot JSON materializes and is I/O-valid`, () => {
      const session = createSpineSession()
      session.addProject({ open: true })
      const proposal = materializeProposal(ex.payload, session.project!, DEFAULT_MODEL, [])
      expect(proposal, `${ex.id} materialize`).toBeTruthy()
      const errors = formatPipelineValidationErrors(
        proposal!.modules,
        proposal!.models,
        proposal!.typeAliases ?? [],
      )
      const kinds = flattenPipelineModules(proposal!.modules).map((s) => s.kind)
      expect(errors, `${ex.id} I/O ${errors}`).toBeFalsy()
      if (ex.topology === "fork") {
        expect(kinds.includes("fork"), `${ex.id} kinds=${kinds.join(",")}`).toBe(true)
      }
      expect(seedHarnessWriteTools(ex.payload).some((t) => t.path === "pipeline.json")).toBe(true)
    })
  }
})
