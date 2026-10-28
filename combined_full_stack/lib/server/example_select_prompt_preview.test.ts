import { describe, expect, it } from "vitest"
import { DEFAULT_EXAMPLE_SELECT_PROMPT } from "@/lib/example-select"
import {
  exampleSelectDesignTimeCacheRegions,
  parseExampleSelectPromptSegments,
} from "@/lib/example-select-prompt-preview"

describe("parseExampleSelectPromptSegments", () => {
  it("marks schema, static text, description, and example regions", () => {
    const segments = parseExampleSelectPromptSegments(DEFAULT_EXAMPLE_SELECT_PROMPT)
    expect(segments[0]?.role).toBe("cached")
    expect(segments.some((s) => s.role === "per_run" && s.text === "{description}")).toBe(true)
    expect(segments.some((s) => s.role === "per_candidate" && s.text === "{example}")).toBe(true)
  })
})

describe("exampleSelectDesignTimeCacheRegions", () => {
  it("shares most bytes across sample candidates when example is last", () => {
    const regions = exampleSelectDesignTimeCacheRegions(DEFAULT_EXAMPLE_SELECT_PROMPT)
    expect(regions).not.toBeNull()
    expect(regions!.candidateCount).toBe(2)
    expect(regions!.prefixChars).toBeGreaterThan(regions!.suffixCharsMax)
  })
})
