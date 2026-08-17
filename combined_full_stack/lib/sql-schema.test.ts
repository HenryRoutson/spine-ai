import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { fillExampleSelectPrompt } from "@/lib/example-select-relevance"
import { buildExampleSelectVerdicts } from "@/lib/example-select-verdicts"
import { SEEDS_DIR, loadProjectSeed } from "@/lib/server/seed"
import {
  allModelsToSql,
  examplePromptColumns,
  parseSqlSelect,
  projectExampleForPrompt,
} from "@/lib/sql-schema"
import { ModuleKind, type ModuleId, type PipelineModule } from "@/lib/types"

const JOB = {
  id: "job-1",
  title: "Upstairs bathroom leak",
  work_description: "Isolate supply and replace ceiling.",
  billed_items: [{ work_item_id: "WI-00100", quantity: 1 }],
}

function stubSelect(patch: Partial<PipelineModule>): PipelineModule {
  return {
    id: "mod_select" as ModuleId,
    kind: ModuleKind.ExampleSelect,
    label: "Select Relevant Jobs",
    note: "",
    cached: true,
    avgMs: 0,
    avgCostCents: 0,
    ...patch,
  }
}

describe("parseSqlSelect", () => {
  it("parses SELECT columns FROM table", () => {
    const parsed = parseSqlSelect("SELECT id, title, work_description FROM job_example")
    expect(parsed).toMatchObject({
      columns: ["id", "title", "work_description"],
      from: "job_example",
      hasJoin: false,
    })
    expect(parsed.error).toBeUndefined()
  })

  it("parses CREATE VIEW … AS SELECT", () => {
    const parsed = parseSqlSelect("CREATE VIEW job_example_prompt AS SELECT id, title FROM job_example")
    expect(parsed.columns).toEqual(["id", "title"])
    expect(parsed.from).toBe("job_example")
    expect(parsed.hasJoin).toBe(false)
  })

  it("treats SELECT * as no projection", () => {
    const parsed = parseSqlSelect("SELECT * FROM job_example")
    expect(parsed.columns).toEqual([])
    expect(parsed.from).toBe("job_example")
    expect(parsed.hasJoin).toBe(false)
  })

  it("rejects JOIN in this slice", () => {
    const parsed = parseSqlSelect("SELECT a FROM t JOIN u ON t.id = u.id")
    expect(parsed.hasJoin).toBe(true)
    expect(parsed.error).toBe("prompt view in this slice is SELECT columns FROM table only (no JOIN)")
  })
})

describe("projectExampleForPrompt", () => {
  it("omits billed_items from the prompt projection", () => {
    const projected = projectExampleForPrompt(JOB, ["title", "work_description"]) as Record<string, unknown>
    expect(projected).toEqual({
      title: JOB.title,
      work_description: JOB.work_description,
    })
    expect("billed_items" in projected).toBe(false)
  })
})

describe("allModelsToSql billed_work", () => {
  it("emits tables, billed_items child table, and the prompt view", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "billed_work_catalog_select.json"))
    const sql = allModelsToSql(project.models, project.modules)
    expect(sql).toContain("CREATE TABLE work_item")
    expect(sql).toContain("CREATE TABLE job_example")
    expect(sql).toContain("CREATE TABLE job_example_billed_items")
    expect(sql).toContain("REFERENCES work_item(id)")
    expect(sql).toMatch(/CREATE VIEW \w+_prompt AS\s+SELECT id, title, work_description FROM job_example/i)
    const viewBlock = sql.slice(sql.search(/CREATE VIEW /i))
    expect(viewBlock).toContain("title")
    expect(viewBlock).toContain("work_description")
    expect(viewBlock).not.toMatch(/SELECT[^\n]*billed_items/i)
  })
})

describe("example-select projection vs passthrough", () => {
  it("prompt JSON has no billed_items; kept rows still have them", () => {
    const m = stubSelect({
      examplePromptView: "SELECT id, title, work_description FROM job_example",
    })
    const cols = examplePromptColumns(m)
    const prompt = fillExampleSelectPrompt(
      "CANDIDATE:\n{example}\nALIAS:\n{input_to_prompt}",
      "leak",
      projectExampleForPrompt(JOB, cols),
    )
    expect(prompt).toContain(JOB.title)
    expect(prompt).not.toContain("billed_items")
    expect(prompt).not.toContain("WI-00100")
    expect(prompt).toContain("ALIAS:")

    const { kept } = buildExampleSelectVerdicts(
      [JOB],
      [{ is_relevant: true, chain_of_thought: "same wet-area leak" }],
      "selection_reason",
    )
    expect(kept).toHaveLength(1)
    expect(kept[0]).toMatchObject({
      id: JOB.id,
      billed_items: JOB.billed_items,
      selection_reason: "same wet-area leak",
    })
  })
})
