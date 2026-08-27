import { describe, expect, it } from "vitest"
import { FieldType, type StructureModel, type StructureModelId } from "@/lib/types"
import { TypeExprKind } from "@/lib/server/type_expr"
import { emptyRowData } from "@/lib/platform-row-store"
import {
  asList,
  displayScalar,
  emptyListHint,
  fieldIsList,
  friendlyFieldName,
  jsonFieldDisplay,
  nestedModelIdForField,
  newListItem,
  parseJsonField,
  parseScalarField,
  listItemNoun,
} from "@/lib/platform-row-fields"

const tableDef: StructureModel = {
  id: "m_table" as StructureModelId,
  name: "TableDef",
  description: "",
  fields: [
    { id: "f_name", name: "name", type: FieldType.Text, optional: false, description: "" },
    { id: "f_fields", name: "fields", type: FieldType.ListModel, optional: false, description: "", ref: "m_field" as StructureModelId },
  ],
}

describe("friendlyFieldName", () => {
  it("turns snake_case into title case", () => {
    expect(friendlyFieldName("app_name")).toBe("App Name")
    expect(friendlyFieldName("tables")).toBe("Tables")
  })
})

describe("list field display", () => {
  it("does not stringify empty arrays or objects into the box", () => {
    expect(jsonFieldDisplay([])).toBe("")
    expect(jsonFieldDisplay({})).toBe("")
    expect(displayScalar([])).toBe("")
    expect(asList([])).toEqual([])
    expect(emptyListHint({ id: "f", name: "tables", type: FieldType.ListModel, optional: false, description: "" })).toBe(
      "No tables yet",
    )
    expect(listItemNoun({ id: "f", name: "tables", type: FieldType.ListModel, optional: false, description: "" })).toBe(
      "table",
    )
  })

  it("treats list[model] as a list and seeds a nested record", () => {
    const field = tableDef.fields[1]!
    expect(fieldIsList(field)).toBe(true)
    expect(nestedModelIdForField(field)).toBe("m_field")
    const item = newListItem(field, [
      tableDef,
      {
        id: "m_field" as StructureModelId,
        name: "FieldDef",
        description: "",
        fields: [{ id: "f_n", name: "name", type: FieldType.Text, optional: false, description: "", examples: ["title"] }],
      },
    ])
    expect(item).toEqual({ name: "title" })
  })

  it("reads list type from typeExpr when FieldType is json-shaped", () => {
    const field = {
      id: "f_pages",
      name: "pages",
      type: FieldType.Json,
      optional: false,
      description: "",
      typeExpr: { kind: TypeExprKind.List, item: { kind: TypeExprKind.Ref, modelId: "m_page" as StructureModelId } },
    }
    expect(fieldIsList(field)).toBe(true)
    expect(nestedModelIdForField(field)).toBe("m_page")
  })
})

describe("scalar parse", () => {
  it("keeps ints as numbers and empty optional as null", () => {
    const score = { id: "f", name: "score", type: FieldType.Int, optional: false, description: "" }
    const flag = { id: "f", name: "ok", type: FieldType.Bool, optional: true, description: "" }
    expect(parseScalarField(score, "12")).toBe(12)
    expect(parseScalarField(flag, "")).toBeNull()
  })

  it("parses JSON and treats blank as an empty object, not the string []", () => {
    expect(parseJsonField("")).toEqual({})
    expect(parseJsonField('{"a":1}')).toEqual({ a: 1 })
  })
})

describe("empty nested row", () => {
  it("seeds list fields as arrays without exposing JSON in display helpers", () => {
    const data = emptyRowData(tableDef)
    expect(data.fields).toEqual([])
    expect(jsonFieldDisplay(data.fields)).toBe("")
  })

  it("seeds typeExpr list fields as arrays even when FieldType is json", () => {
    const model: StructureModel = {
      id: "m_pages" as StructureModelId,
      name: "HasPages",
      description: "",
      fields: [
        {
          id: "f_pages",
          name: "pages",
          type: FieldType.Json,
          optional: false,
          description: "",
          typeExpr: { kind: TypeExprKind.List, item: { kind: TypeExprKind.Ref, modelId: "m_page" as StructureModelId } },
        },
      ],
    }
    expect(emptyRowData(model).pages).toEqual([])
  })
})
