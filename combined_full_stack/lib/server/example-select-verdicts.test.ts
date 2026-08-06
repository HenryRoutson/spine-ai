import { describe, expect, it } from "vitest"
import { buildExampleSelectVerdicts } from "@/lib/example-select-verdicts"

describe("buildExampleSelectVerdicts", () => {
  it("keeps relevant rows and records exclusion chain_of_thought for rejected rows", () => {
    const items = [
      { id: "WI-001", trade: "plumbing" },
      { id: "WI-002", trade: "roofing" },
    ]
    const { kept, verdicts } = buildExampleSelectVerdicts(
      items,
      [
        { is_relevant: true, chain_of_thought: "matches wet area isolation" },
        { is_relevant: false, chain_of_thought: "roof tiles unrelated to indoor leak" },
      ],
      "selection_reason",
    )

    expect(kept).toHaveLength(1)
    expect(kept[0]).toMatchObject({
      id: "WI-001",
      selection_reason: "matches wet area isolation",
    })
    expect(verdicts).toHaveLength(2)
    expect(verdicts[1]).toMatchObject({
      promptIndex: 1,
      is_relevant: false,
      candidateLabel: "WI-002",
      chain_of_thought: "roof tiles unrelated to indoor leak",
    })
  })
})
