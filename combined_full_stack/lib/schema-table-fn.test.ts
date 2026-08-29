import { describe, expect, it } from "vitest"
import {
  allModelsToTableFns,
  defaultInsertSqlForModel,
  derivedInsertSqls,
  shouldDeriveInsertSql,
  sqlLit,
  tableColumnsForModel,
} from "@/lib/schema-table-fn"
import { allModelsToPydantic } from "@/lib/server/pydantic"
import { FieldType, type StructureModel, type StructureModelId } from "@/lib/types"

const lineItem: StructureModel = {
  id: "m_line" as StructureModelId,
  name: "LineItem",
  description: "",
  fields: [{ id: "f_qty", name: "qty", type: FieldType.Int, optional: false, description: "" }],
}

const receiptRow: StructureModel = {
  id: "m_receipt" as StructureModelId,
  name: "ReceiptRow",
  description: "",
  fields: [
    { id: "f_vendor", name: "vendor", type: FieldType.Text, optional: false, description: "" },
    { id: "f_amount", name: "amount", type: FieldType.Float, optional: false, description: "" },
    { id: "f_items", name: "items", type: FieldType.ListModel, optional: false, description: "", ref: lineItem.id },
  ],
}

describe("schema table helpers", () => {
  it("emits SELECT/INSERT from the same structures as models.py / schema.sql", () => {
    const py = allModelsToTableFns([receiptRow, lineItem])
    expect(tableColumnsForModel(receiptRow)).toEqual(["vendor", "amount"])
    expect(py).toContain("class ReceiptRowTable:")
    expect(py).toContain('name = "receipt_row"')
    expect(py).toContain("SELECT * FROM receipt_row")
    expect(py).toContain("INSERT INTO receipt_row (vendor, amount) VALUES (")
    expect(py).not.toContain("items")
    expect(py).toContain("class LineItemTable:")
    expect(py).toContain("INSERT INTO line_item (qty) VALUES (")
  })

  it("appends table helpers onto generated models.py", () => {
    const modelsPy = allModelsToPydantic([receiptRow, lineItem])
    expect(modelsPy).toContain("class ReceiptRow(BaseModel)")
    expect(modelsPy).toContain("class ReceiptRowTable:")
    expect(modelsPy).toContain("def _sql_lit(value):")
  })

  it("derives INSERT keeping quote objects as JSON so highlights survive persist", () => {
    const sql = defaultInsertSqlForModel(
      receiptRow,
      { vendor: { text: "Acme", quote: { doc_id: "sha_x", start: 0, end: 4 } }, amount: 12.5 },
      "row_fixed",
    )
    expect(sql).toContain("row_fixed")
    expect(sql).toContain("Acme")
    expect(sql).toContain("sha_x")
    expect(sql).not.toBe("INSERT INTO receipt_row (id, vendor, amount) VALUES ('row_fixed', 'Acme', 12.5)")
    expect(sqlLit("O'Brien")).toBe("'O''Brien'")
    expect(derivedInsertSqls(receiptRow, [{ vendor: "Acme", amount: 1, id: "a" }])).toEqual([
      "INSERT INTO receipt_row (id, vendor, amount) VALUES ('a', 'Acme', 1)",
    ])
    expect(shouldDeriveInsertSql({ kind: "quote", outStructureId: receiptRow.id }, { outStructureId: receiptRow.id })).toBe(
      true,
    )
    expect(shouldDeriveInsertSql({ kind: "sql", outStructureId: receiptRow.id }, { outStructureId: receiptRow.id })).toBe(
      false,
    )
    expect(shouldDeriveInsertSql({ kind: "llm-batch", outStructureId: "other" }, { outStructureId: receiptRow.id })).toBe(
      false,
    )
  })
})
