import { describe, expect, it } from "vitest"
import {
  analyzePromptCacheRegions,
  longestCommonPrefixLength,
  resolvePromptPreviewItems,
} from "@/lib/prompt-cache-regions"

describe("longestCommonPrefixLength", () => {
  it("returns full length for identical strings", () => {
    expect(longestCommonPrefixLength(["abc", "abc"])).toBe(3)
  })

  it("returns shared prefix length", () => {
    expect(longestCommonPrefixLength(["hello world", "hello there"])).toBe(6)
  })
})

describe("analyzePromptCacheRegions", () => {
  it("returns null for a single prompt", () => {
    expect(analyzePromptCacheRegions(["only one"])).toBeNull()
  })

  it("measures shared schema-first prefix across candidates", () => {
    const shared = "Respond with ONLY a JSON value\n\nDESCRIPTION:\n\nleak\n\nPOSSIBLE USEFUL EXAMPLE:\n\n"
    const a = `${shared}{"id":"a"}`
    const b = `${shared}{"id":"b"}`
    const regions = analyzePromptCacheRegions([a, b])
    expect(regions?.prefixChars).toBe(longestCommonPrefixLength([a, b]))
    expect(regions?.prefixChars).toBeGreaterThan(shared.length)
    expect(regions?.suffixCharsMin).toBe(a.length - regions!.prefixChars)
    expect(regions?.candidateCount).toBe(2)
  })
})

describe("resolvePromptPreviewItems", () => {
  it("falls back to inputPreview when items missing", () => {
    expect(resolvePromptPreviewItems("hello", undefined)).toEqual([
      { label: "prompt", text: "hello" },
    ])
  })
})
