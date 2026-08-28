import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProjectSeed, SEEDS_DIR } from "@/lib/server/seed"
import { migrateProjectModules } from "@/lib/server/validity"
import { hostedPipelineArithPreview, hostedPipelineTraceRows, valueUpdateExpr } from "@/lib/hosted-pipeline-trace"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { ModuleKind } from "@/lib/types"

function seedModules() {
  const seed = loadProjectSeed(resolve(SEEDS_DIR, "double_shared_number.json"))
  return migrateProjectModules(seed.project).modules
}

describe("hosted pipeline JSON walk", () => {
  it("derives Double from the UPDATE value * 2 SQL step", () => {
    const modules = seedModules()
    const double = flattenPipelineModules(modules).find((m) => m.label === "Double")
    expect(double?.sql).toContain("value * 2")
    expect(valueUpdateExpr(double!)?.kind).toBe("binary")
    expect(hostedPipelineArithPreview(modules, "double", 1)).toEqual([
      { moduleId: "mod_sql", label: "Double", from: 1, to: 2, expr: "1 × 2" },
    ])
  })

  it("walks the odd Collatz JSON branch as times-three then plus-one", () => {
    const steps = hostedPipelineArithPreview(seedModules(), "collatz", 1)
    expect(steps.map((s) => s.label)).toEqual(["Times three", "Plus one"])
    expect(steps.map((s) => s.moduleId)).toEqual(["mod_times_three", "mod_plus_one"])
    expect(steps.map((s) => [s.from, s.to, s.expr])).toEqual([
      [1, 3, "1 × 3"],
      [3, 4, "3 + 1"],
    ])
  })

  it("walks the even Collatz JSON branch as divide-by-two", () => {
    const steps = hostedPipelineArithPreview(seedModules(), "collatz", 4)
    expect(steps).toEqual([
      { moduleId: "mod_div_two", label: "Divide by two", from: 4, to: 2, expr: "4 ÷ 2" },
    ])
  })

  it("does not treat Read n or Odd? as animated value steps", () => {
    const modules = seedModules()
    const sql = flattenPipelineModules(modules).filter((m) => m.kind === ModuleKind.Sql)
    const valueSteps = sql.filter((m) => valueUpdateExpr(m))
    expect(valueSteps.map((m) => m.label)).toEqual(["Times three", "Plus one", "Divide by two", "Double"])
  })

  it("binds animation rows to JSON module ids so progress can tick them", () => {
    const planned = hostedPipelineArithPreview(seedModules(), "collatz", 1)
    const running = new Map([["mod_times_three" as const, { status: "running" as const }]])
    const rows = hostedPipelineTraceRows(planned, running)
    expect(rows.map((r) => [r.moduleId, r.label, r.expr, r.state])).toEqual([
      ["mod_times_three", "Times three", "1 × 3", "running"],
      ["mod_plus_one", "Plus one", "3 + 1", "idle"],
    ])
  })
})
