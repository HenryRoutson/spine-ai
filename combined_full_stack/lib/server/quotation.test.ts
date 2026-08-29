import { describe, expect, it } from "vitest"
import {
  findQuoteInSources,
  quoteDisplayText,
  quoteSourcesFromRun,
  resolveQuotesValueFromSources,
} from "@/lib/server/quotation"
import { FieldType, type DocId, type StructureModel, type StructureModelId } from "@/lib/types"

const docA = "alpha only — nothing about vendors"
const docB = "Merchant ACME billed 42 on Tuesday"

describe("multi-doc quotation", () => {
  it("finds an exact quote in a later uploaded file", () => {
    const m = findQuoteInSources("ACME billed 42", [
      { docId: "sha_aaaaaaaaaaaaaaaa" as DocId, text: docA },
      { docId: "sha_bbbbbbbbbbbbbbbb" as DocId, text: docB },
    ])
    expect(m.exact).toBe(true)
    expect(m.docId).toBe("sha_bbbbbbbbbbbbbbbb")
    expect(m.text).toContain("ACME")
  })

  it("quoteSourcesFromRun includes every input module document", () => {
    const store = {
      docs: () => [{ id: "sha_aaaaaaaaaaaaaaaa" as DocId }, { id: "sha_bbbbbbbbbbbbbbbb" as DocId }],
      docContent: (id: DocId) =>
        id === "sha_aaaaaaaaaaaaaaaa" ? docA : id === "sha_bbbbbbbbbbbbbbbb" ? docB : undefined,
    }
    const sources = quoteSourcesFromRun({
      store,
      inputByModule: new Map([
        ["mod_policy", ["sha_aaaaaaaaaaaaaaaa" as DocId]],
        ["mod_receipts", ["sha_bbbbbbbbbbbbbbbb" as DocId]],
      ]),
      sourceText: docA,
      sourceDocId: "sha_aaaaaaaaaaaaaaaa" as DocId,
    })
    expect(sources.map((s) => s.docId).sort()).toEqual(["sha_aaaaaaaaaaaaaaaa", "sha_bbbbbbbbbbbbbbbb"])
  })

  it("resolves tuple[text,quote] against the file that actually contains the span", () => {
    const model: StructureModel = {
      id: "m_row" as StructureModelId,
      name: "ReceiptRow",
      description: "",
      fields: [
        {
          id: "f_vendor",
          name: "vendor",
          type: FieldType.TupleTextQuote,
          optional: false,
          description: "merchant span",
        },
      ],
    }
    const linked = resolveQuotesValueFromSources(
      { vendor: "ACME billed 42" },
      model,
      [model],
      [
        { docId: "sha_aaaaaaaaaaaaaaaa" as DocId, text: docA },
        { docId: "sha_bbbbbbbbbbbbbbbb" as DocId, text: docB },
      ],
      false,
    ) as { vendor: { text: string; quote: { doc_id: DocId } } }
    expect(linked.vendor.quote.doc_id).toBe("sha_bbbbbbbbbbbbbbbb")
    expect(linked.vendor.text).toContain("ACME")
  })

  it("quoteDisplayText shows the copied span and never document ids or offsets", () => {
    const quote = {
      text: "Invoice 4412 — $1,240.00",
      quote: { doc_id: "sha_deadbeef", start: 8, end: 36 },
    }
    expect(quoteDisplayText(quote)).toBe("Invoice 4412 — $1,240.00")
    expect(quoteDisplayText(quote)).not.toMatch(/sha_/)
    expect(quoteDisplayText(quote)).not.toMatch(/\b8\b/)
    expect(quoteDisplayText({ vendor: "ACME" })).toBeNull()
  })
})
