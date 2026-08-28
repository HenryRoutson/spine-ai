import { describe, expect, it } from "vitest"
import { FieldType, ModuleKind, type ModuleId, type PipelineModule, type StructureModel, type StructureModelId } from "@/lib/types"
import { TypeExprKind } from "@/lib/server/type_expr"
import {
  addStructureRow,
  emptyRowData,
  removeStructureRow,
  rowsForModel,
  rowsStoreForProject,
  updateStructureRow,
} from "@/lib/platform-row-store"
import { feedRowJson } from "@/lib/platform-feed"

const model: StructureModel = {
  id: "m_lead" as StructureModelId,
  name: "Lead",
  description: "A row",
  fields: [
    { id: "f_name", name: "name", type: FieldType.Text, optional: false, description: "Name", examples: ["Ada"] },
    { id: "f_score", name: "score", type: FieldType.Int, optional: false, description: "Score" },
    { id: "f_ok", name: "ok", type: FieldType.Bool, optional: true, description: "Flag" },
  ],
}

describe("structure row store", () => {
  it("seeds empty rows from field examples and types", () => {
    const data = emptyRowData(model)
    expect(data.name).toBe("Ada")
    expect(data.score).toBe(0)
    expect(data.ok).toBeNull()
  })

  it("adds, patches, and removes rows in memory", () => {
    const added = addStructureRow({}, model)
    expect(rowsForModel(added.store, model.id)).toHaveLength(1)
    const patched = updateStructureRow(added.store, model.id, added.row.id, { ...added.row.data, name: "Grace" })
    expect(rowsForModel(patched, model.id)[0]?.data.name).toBe("Grace")
    const removed = removeStructureRow(patched, model.id, added.row.id)
    expect(rowsForModel(removed, model.id)).toHaveLength(0)
  })

  it("prefers project.structureRows over an empty local cache", () => {
    const store = rowsStoreForProject({
      id: "p_1" as import("@/lib/types").ProjectId,
      structureRows: { [model.id]: [] },
    })
    expect(store[model.id]).toEqual([])
  })
})

describe("feed row JSON", () => {
  it("wraps a row in an array when the input emits a list", () => {
    const { row } = addStructureRow({}, model)
    const listInput: PipelineModule = {
      id: "mod_in" as ModuleId,
      kind: ModuleKind.Input,
      label: "Leads",
      note: "",
      cached: true,
      avgMs: 1,
      avgCostCents: 0,
      outStructureId: model.id,
      outType: { kind: TypeExprKind.List, item: { kind: TypeExprKind.Ref, modelId: model.id } },
    }
    const json = feedRowJson(row, listInput)
    expect(JSON.parse(json)).toEqual([row.data])
  })

  it("emits a single object when the input is not a list", () => {
    const { row } = addStructureRow({}, model)
    expect(JSON.parse(feedRowJson(row))).toEqual(row.data)
  })
})
