import { describe, expect, it } from "vitest"
import { loadProjectContext } from "@/lib/cli/project_context"
import { SEEDS_DIR } from "@/lib/server/seed"
import { resolve } from "node:path"
import { combineSideInputIndex, derivePipelineMermaid } from "@/lib/pipeline-mermaid"

describe("derivePipelineMermaid", () => {
  it("returns empty placeholder when there are no modules", () => {
    expect(derivePipelineMermaid([], [])).toContain("No pipeline steps yet")
  })

  it("derives a linear flowchart for a seed project", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "batch_llm_example.json"))
    const chart = derivePipelineMermaid(ctx.project.modules, ctx.project.models)
    expect(chart).toMatch(/^flowchart LR/)
    expect(chart).toContain("-->")
    expect(chart.split("-->").length).toBeGreaterThan(ctx.project.modules.length - 1)
    for (const m of ctx.project.modules) {
      expect(chart).toContain(m.label)
    }
  })

  it("includes dashed side-input edges for combine groups", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "procurement_match.json"))
    const combineIndex = ctx.project.modules.findIndex((m) => m.kind === "combine")
    if (combineIndex < 0) return
    const chart = derivePipelineMermaid(ctx.project.modules, ctx.project.models)
    expect(chart).toContain("-. side input .->")
    expect(combineSideInputIndex(ctx.project.modules, combineIndex)).toBeGreaterThanOrEqual(0)
  })
})
