import { describe, expect, it } from "vitest"
import { FieldType, ModuleKind, type ModuleId, type PipelineModule, type StructureModel, type StructureModelId } from "@/lib/types"
import {
  findPortConnections,
  portCompatStatus,
  structureTypeExprForModel,
  wireStructureToInput,
} from "@/lib/platform-type-ports"
import { TypeExprKind } from "@/lib/server/type_expr"

const invoiceId = "m_invoice" as StructureModelId
const otherId = "m_other" as StructureModelId

const invoice: StructureModel = {
  id: invoiceId,
  name: "Invoice",
  description: "A bill",
  fields: [
    { id: "f_total", name: "total", type: FieldType.Int, optional: false, description: "Cents" },
  ],
}

const other: StructureModel = {
  id: otherId,
  name: "Other",
  description: "Unrelated",
  fields: [{ id: "f_x", name: "x", type: FieldType.Text, optional: false, description: "x" }],
}

const inputMod: PipelineModule = {
  id: "mod_in" as ModuleId,
  kind: ModuleKind.Input,
  label: "Invoice JSON",
  note: "",
  inputType: "json" as PipelineModule["inputType"],
  outStructureId: invoiceId,
  cached: true,
  avgMs: 1,
  avgCostCents: 0,
}

describe("typed ports", () => {
  it("treats a structure as an exact match for the same input model", () => {
    const status = portCompatStatus(
      structureTypeExprForModel(invoiceId, false),
      structureTypeExprForModel(invoiceId, false),
      [invoice],
      [],
    )
    expect(status).toBe("exact")
  })

  it("rejects a different structure", () => {
    const status = portCompatStatus(
      structureTypeExprForModel(otherId, false),
      structureTypeExprForModel(invoiceId, false),
      [invoice, other],
      [],
    )
    expect(status).toBe("incompatible")
  })

  it("lists exact connections from Invoice to the JSON input", () => {
    const connections = findPortConnections([inputMod], [invoice, other], [])
    const hits = connections.filter((c) => c.pipelineModuleId === inputMod.id && c.direction === "in")
    expect(hits.some((c) => c.structureName === "Invoice" && c.status === "exact")).toBe(true)
    expect(hits.some((c) => c.structureName === "Other")).toBe(false)
  })

  it("wires outStructureId on the input module", () => {
    const unwired = { ...inputMod, outStructureId: undefined }
    const next = wireStructureToInput([unwired], unwired.id, invoiceId)
    expect(next[0]?.outStructureId).toBe(invoiceId)
  })

  it("builds a list type when asked", () => {
    expect(structureTypeExprForModel(invoiceId, true)).toEqual({
      kind: TypeExprKind.List,
      item: { kind: TypeExprKind.Ref, modelId: invoiceId },
    })
  })
})
