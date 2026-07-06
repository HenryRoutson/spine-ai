import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProjectContext } from "@/lib/cli/project_context"
import { validateProjectCommand } from "@/lib/cli/validate_project"
import { SEEDS_DIR } from "@/lib/server/seed"

describe("validate project command", () => {
  it("passes for example seeds with golden tests", () => {
    const seeds = ["batch_llm_example.json", "gps_site_profiling.json", "procurement_match.json"]
    for (const file of seeds) {
      const ctx = loadProjectContext(resolve(SEEDS_DIR, file))
      const result = validateProjectCommand(ctx)
      expect(result.ok, `${file} should validate`).toBe(true)
    }
  })

  it("reports pipeline issues when a step input type mismatches", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "batch_llm_example.json"))
    const broken = {
      ...ctx.project,
      modules: ctx.project.modules.map((m) =>
        m.id === "mod_batch"
          ? { ...m, inStructureId: "missing_structure" as typeof m.inStructureId }
          : m,
      ),
    }
    const result = validateProjectCommand({ ...ctx, project: broken })
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.where === "Summarize Each Line")).toBe(true)
  })

  it("reports structure issues when models reference missing types", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "batch_llm_example.json"))
    const broken = {
      ...ctx.project,
      models: ctx.project.models.map((m) =>
        m.id === ctx.project.models[0]?.id
          ? {
              ...m,
              fields: m.fields.map((f) => ({ ...f, ref: "missing_model_id" as typeof f.ref })),
            }
          : m,
      ),
    }
    const result = validateProjectCommand({ ...ctx, project: broken })
    expect(result.ok).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })
})
