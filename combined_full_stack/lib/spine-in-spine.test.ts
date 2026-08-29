import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProjectSeed, SEEDS_DIR } from "@/lib/server/seed"
import {
  compileSchemaPack,
  compileSpineApp,
  SPINE_PLATFORM_BLUEPRINT,
  SPINE_SCHEMA_COMPILE_TS,
  SPINE_WEBSITE_COMPILE_TS,
} from "@/lib/spine-in-spine"

describe("Spine-in-Spine compiler", () => {
  it("compiles SQL, hosted slots, upload labels, and typed ports", () => {
    const app = compileSpineApp(SPINE_PLATFORM_BLUEPRINT)
    expect(app.app_name).toBe("Spine")
    expect(app.sql_schema).toContain("CREATE TABLE project")
    expect(app.sql_schema).toContain("name TEXT NOT NULL")
    expect(app.website_html).toContain("{{run}}")
    expect(app.website_html).toContain("{{table:Project}}")
    expect(app.website_html).toContain("{{pay}}")
    expect(app.upload_form_html).toContain("Compile app")
    expect(app.share_copy).toMatch(/one click/i)
    expect(app.typed_ports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table_name: "Project", pipeline_name: "Compile app", status: "exact" }),
      ]),
    )
  })

  it("keeps schema compile a pure function of the blueprint", () => {
    const pack = compileSchemaPack(SPINE_PLATFORM_BLUEPRINT)
    expect(pack.tables).toHaveLength(SPINE_PLATFORM_BLUEPRINT.tables.length)
    expect(pack.sql_schema).toContain("CREATE TABLE structuremodel")
  })

  it("seed custom-code is byte-equal to the compiler source", () => {
    const { project } = loadProjectSeed(join(SEEDS_DIR, "spine_in_spine.json"))
    const schema = project.modules.find((m) => m.label === "Compile schema")
    const website = project.modules.find((m) => m.label === "Compile website")
    expect(schema?.fallbackList?.[0]?.typescript).toBe(SPINE_SCHEMA_COMPILE_TS)
    expect(website?.fallbackList?.[0]?.typescript).toBe(SPINE_WEBSITE_COMPILE_TS)
    const raw = JSON.parse(readFileSync(join(SEEDS_DIR, "spine_in_spine.json"), "utf8")) as {
      modules: { label: string; fallbackList?: { typescript?: string }[] }[]
    }
    expect(raw.modules.find((m) => m.label === "Compile schema")?.fallbackList?.[0]?.typescript).toBe(
      SPINE_SCHEMA_COMPILE_TS,
    )
  })
})
