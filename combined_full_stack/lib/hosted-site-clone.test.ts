import { describe, expect, it } from "vitest"
import {
  assertPublicHttpUrl,
  extractHostedSiteScrape,
  hostedHtmlFromScrape,
  hostedSiteFromScrapedHtml,
  HostedSiteCloneError,
} from "@/lib/hosted-site-clone"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"
import { HOSTED_SITE_RUN_SLOT } from "@/lib/hosted-site-slots"
import { normalizeHostedSiteOptions } from "@/lib/hosted-site"

const PAGE = `<!doctype html>
<html>
<head>
  <title>Northwind Ledger</title>
  <meta name="description" content="Typed invoice ops in one click." />
  <meta name="theme-color" content="#7c3aed" />
  <meta property="og:image" content="https://cdn.example.com/logo.png" />
  <style>a{color:#0f172a}</style>
</head>
<body>
  <h1>Northwind Ledger</h1>
  <h2>Fast ingest</h2>
  <p>Drop PDFs in and get a structured ledger back the same afternoon.</p>
  <h2>Your brand</h2>
  <p>Colors and copy stay yours. Spine hosts the page around the run.</p>
</body>
</html>`

describe("hosted site clone-from-url (open-lovable, no Firecrawl)", () => {
  it("rejects private and non-http URLs", () => {
    expect(() => assertPublicHttpUrl("http://localhost/app")).toThrow(HostedSiteCloneError)
    expect(() => assertPublicHttpUrl("http://127.0.0.1/")).toThrow(HostedSiteCloneError)
    expect(() => assertPublicHttpUrl("http://192.168.1.9/")).toThrow(HostedSiteCloneError)
    expect(() => assertPublicHttpUrl("file:///etc/passwd")).toThrow(HostedSiteCloneError)
    expect(assertPublicHttpUrl("https://example.com/app")).toContain("https://example.com/app")
  })

  it("rebuilds a hosted landing from scraped HTML", () => {
    const url = assertPublicHttpUrl("https://northwind.example/app")
    const extracted = extractHostedSiteScrape(PAGE, url)
    expect(extracted.title).toBe("Northwind Ledger")
    expect(extracted.description).toMatch(/Typed invoice/)
    expect(extracted.primaryColor).toBe("#7c3aed")
    expect(extracted.logoUrl).toBe("https://cdn.example.com/logo.png")
    const html = hostedHtmlFromScrape(extracted, false)
    expect(html).toContain("{{company}}")
    expect(html).toContain("Fast ingest")
    expect(html).not.toContain(HOSTED_SITE_RUN_SLOT)
    expect(html).not.toContain("<script")
  })

  it("keeps {{run}} when a pipeline is already bound and can emit React files", () => {
    const current = normalizeHostedSiteOptions({
      ...DEFAULT_HOSTED_SITE_OPTIONS,
      runtime: "react",
      pipelineBindings: [{ alias: "run", projectId: "p1" }],
      customHtml: `<section>${HOSTED_SITE_RUN_SLOT}</section>`,
    })
    const { siteOptions, extracted } = hostedSiteFromScrapedHtml(PAGE, "https://northwind.example", current)
    expect(extracted.title).toBe("Northwind Ledger")
    expect(siteOptions.customHtml).toContain(HOSTED_SITE_RUN_SLOT)
    expect(siteOptions.runtime).toBe("react")
    expect(siteOptions.reactFiles.some((f) => f.path === "src/App.tsx")).toBe(true)
    expect(siteOptions.brand.companyName).toBe("Northwind Ledger")
    expect(siteOptions.pipelineBindings).toEqual(current.pipelineBindings)
  })
})
