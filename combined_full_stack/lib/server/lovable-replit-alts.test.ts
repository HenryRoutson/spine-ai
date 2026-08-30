import { describe, expect, it } from "vitest"
import { LOVABLE_ALTS_PORTED_GAPS, LOVABLE_REPLIT_ALTS } from "@/lib/server/lovable-replit-alts"

describe("Lovable/Replit OSS alt catalog", () => {
  it("has unique ids and ports only MIT builders", () => {
    const ids = LOVABLE_REPLIT_ALTS.map((a) => a.id)
    expect(ids).toEqual([...new Set(ids)])
    for (const row of LOVABLE_REPLIT_ALTS.filter((a) => a.port)) {
      expect(row.license).toBe("MIT")
    }
  })

  it("lists the gaps this change implements", () => {
    const missing = new Set(LOVABLE_REPLIT_ALTS.flatMap((a) => a.missing))
    for (const gap of LOVABLE_ALTS_PORTED_GAPS) {
      expect(missing.has(gap)).toBe(true)
    }
    expect(LOVABLE_REPLIT_ALTS.some((a) => a.id === "bolt-diy")).toBe(true)
    expect(LOVABLE_REPLIT_ALTS.some((a) => a.id === "open-lovable")).toBe(true)
  })
})
