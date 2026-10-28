import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { SEEDS_DIR, loadProjectSeed } from "@/lib/server/seed"
import { catalogFromDocs } from "@/lib/sql-catalog"
import { buildIdIndex, formatInspectIds } from "@/lib/sql-id-index"
import {
  collectSqlIdTypes,
  fieldSqlIdType,
  idTypeName,
  pkFieldOf,
  suggestFieldRelation,
} from "@/lib/sql-id-types"
import { InputType, type StructureModel } from "@/lib/types"

const SEED = resolve(SEEDS_DIR, "billed_work_catalog_select.json")
const DOCS = resolve(process.cwd(), "documents/billed_work_catalog_select")

describe("sql-id-types billed_work", () => {
  it("names WorkItem.id as work_item_id_string and reuses it on billed line fk", () => {
    const { project } = loadProjectSeed(SEED)
    const workItem = project.models.find((m) => m.name === "WorkItem")!
    const billed = project.models.find((m) => m.name === "BilledLineRef")!
    const pk = pkFieldOf(workItem)!
    expect(idTypeName(workItem, pk)).toBe("work_item_id_string")
    const fk = billed.fields.find((f) => f.name === "work_item_id")!
    expect(fieldSqlIdType(billed, fk, project.models)).toBe("work_item_id_string")
    const types = collectSqlIdTypes(project.models)
    const bucket = types.find((t) => t.name === "work_item_id_string")
    expect(bucket?.fkFields.some((f) => f.field === "work_item_id")).toBe(true)
  })

  it("suggests fk from work_item_id onto WorkItem", () => {
    const { project } = loadProjectSeed(SEED)
    const billed = project.models.find((m) => m.name === "BilledLineRef")!
    const stripped: StructureModel = {
      ...billed,
      fields: billed.fields.map((f) => (f.name === "work_item_id" ? { ...f, relation: undefined } : f)),
    }
    const field = stripped.fields.find((f) => f.name === "work_item_id")!
    expect(suggestFieldRelation(field, stripped, project.models)).toEqual({
      kind: "fk",
      to: { modelId: "m_work_item", field: "id" },
    })
  })
})

describe("sql-id-index billed_work catalog", () => {
  it("indexes work_item ids across catalog + job examples", () => {
    const { project } = loadProjectSeed(SEED)
    const catalog = catalogFromDocs(
      [
        {
          name: "work_item_catalog.json",
          type: InputType.Json,
          content: readFileSync(resolve(DOCS, "work_item_catalog.json"), "utf8"),
        },
        {
          name: "job_example_library.json",
          type: InputType.Json,
          content: readFileSync(resolve(DOCS, "job_example_library.json"), "utf8"),
        },
      ],
      project.models,
    )
    const workTable = catalog.tables.find((t) => t.name === "work_item")
    const child = catalog.tables.find((t) => t.name === "job_example_billed_items")
    expect(workTable?.rows.length).toBeGreaterThan(10)
    expect(child?.rows.length).toBeGreaterThan(10)

    const index = buildIdIndex(catalog, project.models)
    const bucket = index.buckets.find((b) => b.idType === "work_item_id_string")
    expect(bucket).toBeTruthy()
    expect(bucket!.pkCount).toBeGreaterThan(10)
    expect(bucket!.fkCount).toBeGreaterThan(10)
    const wi1 = bucket!.values.get("WI-00001")
    expect(wi1?.some((o) => o.kind === "pk")).toBe(true)
    expect(wi1?.some((o) => o.kind === "fk")).toBe(true)

    const report = formatInspectIds(index, project.models, { idType: "work_item_id_string", filter: "all" })
    expect(report.idTypes[0]?.name).toBe("work_item_id_string")
    expect(report.values.some((v) => v.value === "WI-00001" && v.status === "ok")).toBe(true)
  })
})
