import { describe, expect, it } from "vitest"
import {
  allModelsToPromptsMd,
  allModelsToZodSrc,
  structureExtractionPrompt,
  withStructurePrompt,
} from "@/lib/schema-derived"
import { defaultSelectSqlForModel, defaultSelectSqlForModule } from "@/lib/schema-table-fn"
import { computeInvalid, InvalidKind } from "@/lib/server/validity"
import { FieldType, ModuleKind, type ModuleId, type StructureModel, type StructureModelId } from "@/lib/types"

const lineItem: StructureModel = {
  id: "m_line" as StructureModelId,
  name: "LineItem",
  description: "One line.",
  fields: [{ id: "f_qty", name: "qty", type: FieldType.Int, optional: false, description: "Count" }],
}

const receiptRow: StructureModel = {
  id: "m_receipt" as StructureModelId,
  name: "ReceiptRow",
  description: "One receipt.",
  fields: [
    {
      id: "f_vendor",
      name: "vendor",
      type: FieldType.Text,
      optional: false,
      description: "Merchant name",
      examples: ["Acme"],
    },
    { id: "f_amount", name: "amount", type: FieldType.Float, optional: false, description: "Total" },
    { id: "f_items", name: "items", type: FieldType.ListModel, optional: false, description: "", ref: lineItem.id },
    { id: "f_note", name: "note", type: FieldType.Text, optional: true, description: "Optional memo" },
  ],
}

describe("schema-derived Zod and prompts", () => {
  it("prints Zod objects from the same structures as SQL helpers", () => {
    const src = allModelsToZodSrc([receiptRow, lineItem])
    expect(src).toContain("export const ReceiptRow = z.object({")
    expect(src).toContain('"vendor": z.string().describe("Merchant name — Examples: \\"Acme\\"")')
    expect(src).toContain('"amount": z.number()')
    expect(src).toContain('"note": z.string().describe("Optional memo").optional()')
    expect(src).toContain("z.array(z.lazy(() => LineItem))")
    expect(src).toContain("export const LineItem = z.object({")
  })

  it("builds extraction prompts from field descriptions and examples", () => {
    const prompt = structureExtractionPrompt(receiptRow, [receiptRow, lineItem])
    expect(prompt).toContain("Extract JSON for ReceiptRow — One receipt.")
    expect(prompt).toContain("- vendor (text, required): Merchant name Examples: \"Acme\"")
    expect(prompt).toContain("- note (text, optional): Optional memo")
    expect(withStructurePrompt("Keep amounts numeric.", receiptRow, [receiptRow, lineItem])).toContain(
      "Keep amounts numeric.",
    )
    expect(withStructurePrompt("Keep amounts numeric.", receiptRow, [receiptRow, lineItem])).toContain(
      "Merchant name",
    )
  })

  it("writes derived/prompts.md sections per model", () => {
    const md = allModelsToPromptsMd([receiptRow, lineItem])
    expect(md).toContain("## ReceiptRow")
    expect(md).toContain("## LineItem")
    expect(md).toContain("Leave step prompts empty")
  })

  it("derives SELECT * from the out structure", () => {
    expect(defaultSelectSqlForModel(receiptRow)).toBe("SELECT * FROM receipt_row")
    expect(defaultSelectSqlForModule({ outStructureId: receiptRow.id }, [receiptRow, lineItem])).toBe(
      "SELECT * FROM receipt_row",
    )
    expect(defaultSelectSqlForModule({ outStructureId: "missing" }, [receiptRow])).toBeNull()
  })

  it("does not flag MissingSql when SELECT * can be derived from the out structure", () => {
    const sqlMod = {
      id: "mod_sql" as ModuleId,
      kind: ModuleKind.Sql,
      label: "Read rows",
      note: "schema-derived select",
      inputDescription: "ignored",
      outStructureId: receiptRow.id,
      cached: false,
      avgMs: 1,
      avgCostCents: 0,
    }
    const issues = [...computeInvalid([sqlMod], [receiptRow, lineItem]).values()].flat()
    expect(issues.filter((i) => i.kind === InvalidKind.MissingSql)).toEqual([])
    const bare = { ...sqlMod, outStructureId: undefined }
    const missing = [...computeInvalid([bare], [receiptRow]).values()].flat()
    expect(missing.some((i) => i.kind === InvalidKind.MissingSql)).toBe(true)
  })
})
