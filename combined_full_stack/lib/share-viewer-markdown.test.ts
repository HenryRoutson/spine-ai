import { describe, expect, it } from "vitest"
import { composeViewerMarkdown, normalizeViewerMarkdown } from "@/lib/share-viewer-markdown"

describe("composeViewerMarkdown", () => {
  it("stays empty when usage docs are off even if text exists", () => {
    expect(
      composeViewerMarkdown({
        showDocs: false,
        instructions: "# How to use\nUpload a PDF.",
        appendProjectDocs: true,
        projectDocumentation: "INTERNAL: never leak",
      }),
    ).toBe("")
  })

  it("does not append project docs unless asked", () => {
    expect(
      composeViewerMarkdown({
        showDocs: true,
        instructions: "Upload a receipt, then Run.",
        appendProjectDocs: false,
        projectDocumentation: "INTERNAL: never leak",
      }),
    ).toBe("Upload a receipt, then Run.")
  })

  it("appends project docs after custom instructions when enabled", () => {
    expect(
      composeViewerMarkdown({
        showDocs: true,
        instructions: "Upload a receipt.",
        appendProjectDocs: true,
        projectDocumentation: "Extract vendor and amount.",
      }),
    ).toBe("Upload a receipt.\n\nExtract vendor and amount.")
  })

  it("can publish project docs alone when instructions are empty", () => {
    expect(
      composeViewerMarkdown({
        showDocs: true,
        instructions: "  ",
        appendProjectDocs: true,
        projectDocumentation: "Extract vendor and amount.",
      }),
    ).toBe("Extract vendor and amount.")
  })
})

describe("normalizeViewerMarkdown", () => {
  it("trims and rejects non-strings", () => {
    expect(normalizeViewerMarkdown("  hello  ")).toBe("hello")
    expect(normalizeViewerMarkdown(null)).toBe("")
    expect(normalizeViewerMarkdown(12)).toBe("")
  })
})
