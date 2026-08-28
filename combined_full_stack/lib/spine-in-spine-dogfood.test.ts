import { describe, expect, it } from "vitest"
import {
  SPINE_FULL_PIXEL_SCENES,
  SPINE_IN_SPINE_OSS_CLONES,
} from "@/lib/spine-in-spine-dogfood"

describe("Spine-in-Spine dogfood catalog", () => {
  it("has unique clone ids", () => {
    const ids = SPINE_IN_SPINE_OSS_CLONES.map((c) => c.id)
    expect(ids).toEqual([...new Set(ids)])
  })

  it("lists at least one simple, full, and negative target", () => {
    const tracks = new Set(SPINE_IN_SPINE_OSS_CLONES.map((c) => c.track))
    expect(tracks.has("simple")).toBe(true)
    expect(tracks.has("both") || tracks.has("full")).toBe(true)
    expect(tracks.has("negative")).toBe(true)
  })

  it("pins full pixel scenes to homework_grader", () => {
    expect(SPINE_FULL_PIXEL_SCENES.length).toBeGreaterThan(5)
    expect(SPINE_FULL_PIXEL_SCENES.every((s) => s.seed === "homework_grader")).toBe(true)
  })
})
