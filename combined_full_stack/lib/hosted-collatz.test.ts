import { describe, expect, it } from "vitest"
import {
  collatzPreview,
  doublePreview,
  hostedArithLabels,
  hostedPreviewLines,
  parseHostedNumber,
} from "@/lib/hosted-collatz"

describe("hosted collatz preview", () => {
  it("parses the live SQL number", () => {
    expect(parseHostedNumber(1)).toBe(1)
    expect(parseHostedNumber("4")).toBe(4)
    expect(parseHostedNumber(null)).toBeNull()
  })

  it("doubles in one step", () => {
    expect(doublePreview(1)).toEqual([{ label: "Double", from: 1, to: 2, expr: "1 × 2" }])
  })

  it("breaks odd 3n+1 into times three and plus one", () => {
    expect(collatzPreview(1)).toEqual([
      { label: "Times three", from: 1, to: 3, expr: "1 × 3" },
      { label: "Plus one", from: 3, to: 4, expr: "3 + 1" },
    ])
    expect(hostedArithLabels("collatz", 1)).toEqual(["Times three", "Plus one"])
  })

  it("divides even n once", () => {
    expect(collatzPreview(4)).toEqual([{ label: "Divide by two", from: 4, to: 2, expr: "4 ÷ 2" }])
  })

  it("shows both numbers on each card", () => {
    expect(hostedPreviewLines("double", 1)).toEqual([{ expr: "1 × 2", result: "2" }])
    expect(hostedPreviewLines("collatz", 1)).toEqual([
      { expr: "1 × 3", result: "3" },
      { expr: "3 + 1", result: "4" },
    ])
    expect(hostedPreviewLines("double", null)).toEqual([{ expr: "n × 2", result: "2n" }])
    expect(hostedPreviewLines("collatz", null)).toEqual([
      { expr: "n × 3", result: "3n" },
      { expr: "3n + 1", result: "3n+1" },
    ])
  })
})
