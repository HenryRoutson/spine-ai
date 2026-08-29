import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("json-viewer quote UX", () => {
  const html = readFileSync(resolve(process.cwd(), "../shared/json-viewer/json-viewer.html"), "utf8")

  it("renders linked quotes as highlighted chips that open the parent document viewer", () => {
    expect(html).toContain("quote-chip")
    expect(html).toContain("json-viewer:open-quote")
    expect(html).toContain("function linkedQuoteOf")
    expect(html).toContain("Open highlighted source")
  })

  it("does not present Doc Id / Start / End as user-facing labels", () => {
    expect(html).not.toMatch(/Doc Id/)
    expect(html).not.toMatch(/>Start</)
    expect(html).not.toMatch(/>End</)
    expect(html).not.toContain("🔗 Quote ↗")
  })
})
