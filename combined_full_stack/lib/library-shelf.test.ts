import { describe, expect, it } from "vitest"
import { LIBRARY_SHELVES } from "@/lib/library-shelf"

describe("library shelves", () => {
  it("is the same four buckets for pipelines and websites", () => {
    expect(LIBRARY_SHELVES.map((s) => s.id)).toEqual(["yours", "shared", "marketplace", "templates"])
    for (const shelf of LIBRARY_SHELVES) {
      expect(shelf.hint("pipelines").length).toBeGreaterThan(8)
      expect(shelf.hint("websites").length).toBeGreaterThan(8)
    }
  })
})
