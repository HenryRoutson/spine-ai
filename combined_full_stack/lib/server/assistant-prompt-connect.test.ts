import { describe, expect, it } from "vitest"
import {
  buildHumanSurfacePromptBlock,
  buildLinearIoPromptBlock,
  buildMultiDocumentWorkflowPromptBlock,
  buildPipelineRulesPromptBlock,
  buildPipelineValidationErrorsPromptBlock,
} from "@/lib/server/assistant-prompt"
import { DEFAULT_MODEL } from "@/lib/server/types"

describe("assistant connect allowlist", () => {
  it("lists AP allowlist ids on the build prompt", () => {
    const block = buildPipelineRulesPromptBlock(DEFAULT_MODEL)
    expect(block).toContain("ap.slack.send_channel_message")
    expect(block).toContain("ap.gmail.send_email")
    expect(block).toContain("ap.google-sheets.append_row")
    expect(block).toContain("slack.postMessage")
  })

  it("tells the model Excel/JSON-only inputs cannot emit Document", () => {
    const io = buildLinearIoPromptBlock()
    const multi = buildMultiDocumentWorkflowPromptBlock()
    const errors = buildPipelineValidationErrorsPromptBlock()
    expect(io).toContain("excel/json-ONLY inputs MUST structureOut a typed model")
    expect(io).not.toMatch(/input only ever emits Document/)
    expect(multi).toContain("Excel/json-only inputs MUST structureOut a typed model")
    expect(errors).toContain("Excel/JSON-only inputs must use a structure")
  })

  it("vibe copy prefers vendor ids and forbids naming Nango or Activepieces to the human", () => {
    const vibe = buildHumanSurfacePromptBlock("vibe")
    expect(vibe).toContain("slack.postMessage")
    expect(vibe).toMatch(/Never mention[\s\S]*Nango[\s\S]*Activepieces/)
    expect(vibe).not.toMatch(/open Activepieces|Activepieces CE|use Nango/i)
    expect(buildHumanSurfacePromptBlock("build")).toBe("")
  })
})
