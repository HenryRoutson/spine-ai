import { describe, expect, it } from "vitest"
import { FieldType, type StructureModel, type StructureModelId } from "@/lib/types"
import { allModelsToJsonSchema, modelToJsonSchema } from "@/lib/windmill/schema"
import { sqlTableName } from "@/lib/sql-id-types"

const moon: StructureModel = {
  id: "m_moon" as StructureModelId,
  name: "MoonFact",
  description: "Deterministic count vs probabilistic summary.",
  fields: [
    {
      id: "f_count",
      name: "count",
      type: FieldType.Int,
      optional: false,
      description: "How many moons does earth have?",
      deterministic: true,
    },
    {
      id: "f_summary",
      name: "summary",
      type: FieldType.Text,
      optional: false,
      description: "summarise the book",
      deterministic: false,
    },
  ],
}

describe("Windmill JSON Schema from Zod structures", () => {
  it("stamps SQL table + deterministic vs probabilistic extras", () => {
    const schema = modelToJsonSchema(moon)
    expect(schema["x-spine-sql-table"]).toBe(sqlTableName("MoonFact"))
    const props = schema.properties as Record<string, Record<string, unknown>>
    expect(props.count["x-spine-deterministic"]).toBe(true)
    expect(props.summary["x-spine-deterministic"]).toBe(false)
    expect(props.count.type).toBe("integer")
    expect(props.summary.type).toBe("string")
  })

  it("exports $defs for user models", () => {
    const doc = allModelsToJsonSchema([moon])
    expect(doc.$defs).toHaveProperty("MoonFact")
    expect(JSON.stringify(doc)).toContain("x-spine-sql-table")
  })

  it("stamps quote fields for click-to-highlight", () => {
    const quoted: StructureModel = {
      ...moon,
      id: "m_quoted" as StructureModelId,
      name: "QuotedFact",
      fields: [
        ...moon.fields,
        {
          id: "f_excerpt",
          name: "excerpt",
          type: FieldType.TupleTextQuote,
          optional: false,
          description: "span in the source document",
        },
      ],
    }
    const schema = modelToJsonSchema(quoted)
    const props = schema.properties as Record<string, Record<string, unknown>>
    expect(props.excerpt["x-spine-quote"]).toBe(true)
    expect(props.count["x-spine-quote"]).toBeUndefined()
  })
})
