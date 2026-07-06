import { describe, expect, it } from "vitest"
import { buildLandingUsageProfile } from "@/lib/server/landing_page_demo"
import { formatLandingProfileHuman } from "@/lib/cli/profile_landing"
import type { LandingDemoCallRow } from "@/lib/server/landing_page_demo"
import type { ModelId } from "@/lib/server/types"

const model = "gpt-5-mini" as ModelId

function call(partial: Partial<LandingDemoCallRow> & Pick<LandingDemoCallRow, "costCents" | "createdAt">): LandingDemoCallRow {
  return {
    id: partial.id ?? "c1",
    promptPreview: partial.promptPreview ?? "build a pipeline",
    outputPreview: partial.outputPreview ?? null,
    model: partial.model ?? model,
    promptTokens: partial.promptTokens ?? 100,
    completionTokens: partial.completionTokens ?? 50,
    costCents: partial.costCents,
    latencyMs: partial.latencyMs ?? 1200,
    createdAt: partial.createdAt,
  }
}

describe("landing usage profile", () => {
  it("aggregates cost, tokens, model, and day buckets", () => {
    const profile = buildLandingUsageProfile(
      5000,
      12.5,
      [
        call({ costCents: 5, createdAt: "2026-07-05T10:00:00.000Z", promptTokens: 80, completionTokens: 40 }),
        call({ costCents: 7.5, createdAt: "2026-07-06T11:00:00.000Z", promptTokens: 120, completionTokens: 60 }),
      ],
      "supabase",
    )
    expect(profile.callCount).toBe(2)
    expect(profile.totalCostCents).toBe(12.5)
    expect(profile.totalPromptTokens).toBe(200)
    expect(profile.remainingCents).toBe(4987.5)
    expect(profile.byModel[model]?.calls).toBe(2)
    expect(profile.byDay.map((d) => d.day)).toEqual(["2026-07-05", "2026-07-06"])
  })

  it("formatLandingProfileHuman includes budget and recent call lines", () => {
    const profile = buildLandingUsageProfile(
      5000,
      5,
      [call({ costCents: 5, createdAt: "2026-07-06T11:00:00.000Z", promptPreview: "summarize receipts" })],
      "local",
    )
    const text = formatLandingProfileHuman(profile, { days: 30, limit: 10 })
    expect(text).toContain("budget:")
    expect(text).toContain("summarize receipts")
    expect(text).toContain("source: local")
  })
})
