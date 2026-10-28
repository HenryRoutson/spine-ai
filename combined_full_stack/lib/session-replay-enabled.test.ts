import { describe, expect, it } from "vitest"
import { parseSessionReplayEnabled } from "@/lib/session-replay-enabled"

describe("parseSessionReplayEnabled", () => {
  it("defaults off", () => {
    expect(parseSessionReplayEnabled(undefined)).toBe(false)
    expect(parseSessionReplayEnabled("")).toBe(false)
    expect(parseSessionReplayEnabled("false")).toBe(false)
  })

  it("accepts true/1/yes/on", () => {
    expect(parseSessionReplayEnabled("true")).toBe(true)
    expect(parseSessionReplayEnabled("1")).toBe(true)
    expect(parseSessionReplayEnabled("yes")).toBe(true)
    expect(parseSessionReplayEnabled("ON")).toBe(true)
  })
})
