import { describe, expect, it } from "vitest"
import { areaForTuiTab, tuiTabFromHotkey, TUI_TAB_META, resolveTuiTab } from "@/lib/core/view"
import { tokenizeJsonLine, looksLikeJson } from "@/lib/cli/ink/syntax"
import { defaultPaneForTab, nextActionHint, suggestedCommandId } from "@/lib/cli/ink/commands"

describe("TUI tab chrome", () => {
  it("maps number keys like the full UI 01–10 hints", () => {
    expect(tuiTabFromHotkey("1")).toBe("structure")
    expect(tuiTabFromHotkey("2")).toBe("pipeline")
    expect(tuiTabFromHotkey("7")).toBe("logging")
    expect(tuiTabFromHotkey("0")).toBe("docs")
    expect(tuiTabFromHotkey("b")).toBe("billing")
    expect(resolveTuiTab("logs")).toBe("logging")
    expect(areaForTuiTab("logging")).toBe("observe")
    expect(defaultPaneForTab("logging")).toBe("runs")
  })

  it("annotates every tab with the web UI description", () => {
    expect(TUI_TAB_META.logging.description).toMatch(/per-step trace/)
    expect(TUI_TAB_META.testing.empty).toMatch(/testing\.json/)
  })
})

describe("JSON ink tokens", () => {
  it("colors keys, strings, and numbers", () => {
    expect(looksLikeJson('{"a":1}')).toBe(true)
    const tokens = tokenizeJsonLine('{"vendor":"Acme","total":12.5}')
    expect(tokens.some((t) => t.color === "cyan" && t.text.includes("vendor"))).toBe(true)
    expect(tokens.some((t) => t.color === "green" && t.text.includes("Acme"))).toBe(true)
    expect(tokens.some((t) => t.color === "yellow" && t.text.includes("12.5"))).toBe(true)
  })
})

describe("TUI next-action hints", () => {
  it("suggests inference from an empty logging tab", () => {
    const ctx = {
      hasProject: true,
      hasProposal: false,
      hasSteps: true,
      tab: "logging" as const,
      hasRuns: false,
      hasTests: false,
      projectCount: 1,
      validation: { ok: true, issues: [] },
    }
    expect(suggestedCommandId(ctx)).toBe("run-inference")
    expect(nextActionHint(ctx)).toMatch(/press i/)
  })
})
