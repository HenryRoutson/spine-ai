import { describe, expect, it } from "vitest"
import { collectQuotes, exportedQuoteFromLinked, quoteHref } from "@/lib/quotes"
import type { DocId } from "@/lib/types"

describe("exportedQuoteFromLinked", () => {
  it("deep-clones then spreads quote fields instead of restating them", () => {
    const src = {
      text: "Acme Corp",
      quote: { doc_id: "sha_abc" as DocId, start: 0, end: 9 },
    }
    const exported = exportedQuoteFromLinked(src)
    expect(exported).toEqual({
      text: "Acme Corp",
      doc_id: "sha_abc",
      start: 0,
      end: 9,
      href: quoteHref(src.quote),
    })
    src.quote.start = 4
    expect(exported.start).toBe(0)
    expect(exported.href).toBe("doc://sha_abc#0-9")
  })

  it("collectQuotes uses the same clone path for nested values", () => {
    const quotes = collectQuotes({
      row: {
        text: "Acme Corp",
        quote: { doc_id: "sha_abc" as DocId, start: 4, end: 9 },
      },
    })
    expect(quotes).toHaveLength(1)
    expect(quotes[0]).toMatchObject({ text: "Acme Corp", doc_id: "sha_abc", start: 4, end: 9 })
  })
})
