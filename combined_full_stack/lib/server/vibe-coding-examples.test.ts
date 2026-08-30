// AI : every few-shot example must parse, materialize, and stay I/O-valid — that is the reliability floor.
import { describe, expect, it } from "vitest"
import { createSpineSession } from "@/lib/core/session"
import { DEFAULT_MODEL } from "@/lib/types"
import { materializeProposal } from "@/lib/server/pipeline_assistant"
import { formatPipelineValidationErrors } from "@/lib/server/validity"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import {
  exampleTopologyHit,
  matchVibeExample,
  parseFewShotVibeExamples,
  retrieveVibeExamples,
  seedHarnessWriteTools,
  vibeExampleTasks,
} from "@/lib/server/vibe-coding-examples"
import { compileSpineJs } from "@/lib/spine-js/compile"
import { payloadToWorkflow } from "@/lib/spine-js/payload-to-workflow"

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
      expect(seedHarnessWriteTools(ex.payload).some((t) => t.path === "pipeline.ts" || t.path === "pipeline.json")).toBe(true)
    })
  }

  it("retrieves 1–3 nearest examples instead of dumping the catalog", () => {
    const receipts = retrieveVibeExamples("Convert hundreds of unstructured receipts into a single Excel file", 3)
    expect(receipts.length).toBeLessThanOrEqual(3)
    expect(receipts[0]?.id).toBe("ex1")
    const audit = retrieveVibeExamples("Check expense line items against a policy table", 3)
    expect(audit[0]?.id).toBe("ex3")
    const fork = retrieveVibeExamples("From one contract extract risks, parties, and dates independently, then write a memo", 3)
    expect(fork[0]?.id).toBe("ex5")
  })

  for (const ex of vibeExampleTasks()) {
    it(`${ex.id} workflow TypeScript compiles and hits topology`, () => {
      const src = payloadToWorkflow(ex.payload)
      expect(src).toMatch(/export const main = workflow/)
      expect(src).not.toMatch(/"kind":/)
      const compiled = compileSpineJs(src)
      expect(compiled.ok, `${ex.id}: ${compiled.ok ? "" : compiled.errors.join("; ")}`).toBe(true)
      if (!compiled.ok) return
      const kinds = compiled.program.modules.map((m) => m.kind)
      const inputs = kinds.filter((k) => k === "input").length
      expect(exampleTopologyHit(ex, kinds, inputs), `${ex.id} kinds=${kinds.join(",")}`).toBe(true)
      const session = createSpineSession()
      session.addProject({ open: true })
      const proposal = materializeProposal(compiled.raw, session.project!, DEFAULT_MODEL, [])
      expect(proposal, `${ex.id} materialize from workflow`).toBeTruthy()
      const errors = formatPipelineValidationErrors(
        proposal!.modules,
        proposal!.models,
        proposal!.typeAliases ?? [],
      )
      expect(errors, `${ex.id} workflow I/O ${errors}`).toBeFalsy()
    })
  }
})
