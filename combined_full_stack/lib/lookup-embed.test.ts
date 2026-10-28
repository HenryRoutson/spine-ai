import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { applyLookupEmbeds, autoFkEmbedSpecs, indexRowsByKey } from "@/lib/lookup-embed"
import { SEEDS_DIR, loadProjectSeed } from "@/lib/server/seed"
import type { StructureModelId } from "@/lib/types"

const CATALOG = [
  {
    id: "WI-00002",
    code: "PLB-RPR-002",
    trade: "plumbing",
    unit: "each",
    description: "Repair burst flexi hose at vanity basin",
  },
]

const CONTEXT = {
  description: "Water leaked from the upstairs bathroom suite.",
  selected_examples: [
    {
      id: "job-bathroom-ceiling-collapse",
      billed_items: [{ work_item_id: "WI-00002", quantity: 1 }],
    },
  ],
}

describe("lookup-embed", () => {
  it("spreads catalog description onto billed_items without mutating the spine", () => {
    const expanded = applyLookupEmbeds(
      CONTEXT,
      [{ leftPath: "selected_examples.billed_items", leftKey: "work_item_id", rightKey: "id", how: "spread" }],
      CATALOG,
    ) as { selected_examples: { billed_items: Record<string, unknown>[] }[] }
    expect(expanded.selected_examples[0]?.billed_items[0]).toMatchObject({
      work_item_id: "WI-00002",
      quantity: 1,
      code: "PLB-RPR-002",
      description: "Repair burst flexi hose at vanity basin",
    })
    expect(CONTEXT.selected_examples[0]?.billed_items[0]).toEqual({ work_item_id: "WI-00002", quantity: 1 })
  })

  it("indexes billed_work ItemFilterContext FKs onto WorkItem for pass 2", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "billed_work_catalog_select.json"))
    const specs = autoFkEmbedSpecs(
      project.models,
      "m_item_filter_ctx" as StructureModelId,
      "m_work_item" as StructureModelId,
    )
    expect(specs).toEqual([
      {
        leftPath: "selected_examples.billed_items",
        leftKey: "work_item_id",
        rightKey: "id",
        how: "spread",
      },
    ])
    const expanded = applyLookupEmbeds(CONTEXT, specs, CATALOG) as {
      selected_examples: { billed_items: { description?: string }[] }[]
    }
    expect(expanded.selected_examples[0]?.billed_items[0]?.description).toBe(
      "Repair burst flexi hose at vanity basin",
    )
  })

  it("leaves missing catalog ids as normalized FKs", () => {
    const expanded = applyLookupEmbeds(
      { billed_items: [{ work_item_id: "WI-99999", quantity: 2 }] },
      [{ leftPath: "billed_items", leftKey: "work_item_id", rightKey: "id", how: "spread" }],
      CATALOG,
    ) as { billed_items: { work_item_id: string; quantity: number }[] }
    expect(expanded.billed_items[0]).toEqual({ work_item_id: "WI-99999", quantity: 2 })
  })
})

describe("indexRowsByKey", () => {
  it("keys catalog rows by id", () => {
    expect(indexRowsByKey(CATALOG, "id").get("WI-00002")?.code).toBe("PLB-RPR-002")
  })
})
