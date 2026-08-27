import { describe, expect, it } from "vitest"
import {
  buildHumanSurfacePromptBlock,
  buildPipelineRulesPromptBlock,
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

  it("vibe copy prefers vendor ids and forbids naming Nango or Activepieces to the human", () => {
    const vibe = buildHumanSurfacePromptBlock("vibe")
    expect(vibe).toContain("slack.postMessage")
    expect(vibe).toMatch(/Never mention[\s\S]*Nango[\s\S]*Activepieces/)
    expect(vibe).not.toMatch(/open Activepieces|Activepieces CE|use Nango/i)
    expect(buildHumanSurfacePromptBlock("build")).toBe("")
  })
})
