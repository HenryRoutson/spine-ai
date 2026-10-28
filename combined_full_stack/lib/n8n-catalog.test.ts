import { describe, expect, it } from "vitest"
import { getN8nNode, listN8nNodes, missingN8nParams, registerSharedPiece } from "@/lib/n8n-catalog"
import { runN8nPiece, spineToN8nItems } from "@/lib/n8n-run"

describe("n8n typed pieces", () => {
  it("lists shareable action pieces (no triggers)", () => {
    const types = listN8nNodes().map((p) => p.n8nNodeType)
    expect(types).toContain("n8n-nodes-base.set")
    expect(types).toContain("n8n-nodes-base.filter")
    expect(types).toContain("n8n-nodes-base.spreadsheetFile")
    expect(getN8nNode("piece.set")?.n8nNodeType).toBe("n8n-nodes-base.set")
    expect(getN8nNode("piece.filter")?.n8nNodeType).toBe("n8n-nodes-base.filter")
    expect(types.every((t) => !t.includes("trigger"))).toBe(true)
  })

  it("runs Set assignments as n8n Code-node JS", async () => {
    const out = (await runN8nPiece({
      n8nNodeType: "n8n-nodes-base.set",
      n8nParameters: { keepOnlySet: true, assignments: { vendor: "={{ $json.name }}", ok: "yes" } },
      input: { name: "Acme", extra: "drop" },
    })) as Record<string, unknown>
    expect(out.vendor).toBe("Acme")
    expect(out.ok).toBe("yes")
    expect(out.extra).toBeUndefined()
  })

  it("filters a list", async () => {
    const out = await runN8nPiece({
      n8nNodeType: "n8n-nodes-base.filter",
      n8nParameters: { field: "status", operator: "equals", value: "open" },
      input: [
        { status: "open", id: "1" },
        { status: "closed", id: "2" },
      ],
    })
    expect(out).toEqual([{ status: "open", id: "1" }])
  })

  it("parses CSV into rows", async () => {
    const out = (await runN8nPiece({
      n8nNodeType: "n8n-nodes-base.spreadsheetFile",
      n8nParameters: { field: "csv", outputField: "rows" },
      input: { csv: "a,b\n1,2\n3,4" },
    })) as { rows: Array<Record<string, string>> }
    expect(out.rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ])
  })

  it("wraps a single object as one n8n item", () => {
    expect(spineToN8nItems({ email: "a@b.c" })).toEqual([{ json: { email: "a@b.c" } }])
  })

  it("flags missing required params", () => {
    const set = getN8nNode("n8n-nodes-base.set")
    expect(set).toBeTruthy()
    expect(missingN8nParams(set!, {})).toContain("Assignments")
  })

  it("registers a shared piece overlay", async () => {
    registerSharedPiece({
      id: "spine.pieces.upper",
      n8nNodeType: "spine.pieces.upper",
      displayName: "Uppercase field",
      description: "Shared community piece",
      category: "shared",
      props: [{ name: "field", displayName: "Field", type: "string", required: true, default: "name" }],
      n8nCode: `const field = String($parameter.field ?? "name");
return items.map((item) => ({ json: { ...item.json, [field]: String(item.json?.[field] ?? "").toUpperCase() } }));`,
    })
    const out = (await runN8nPiece({
      n8nNodeType: "spine.pieces.upper",
      n8nParameters: { field: "name" },
      input: { name: "acme" },
    })) as { name: string }
    expect(out.name).toBe("ACME")
  })
})
