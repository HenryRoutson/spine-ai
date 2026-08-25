import { describe, expect, it } from "vitest"
import {
  applyHostedSiteTokens,
  compileHostedSiteHtml,
  DEFAULT_HOSTED_SITE_HTML,
  HOSTED_SITE_RUN_SLOT,
  isSafeLogoUrl,
  isSiteLinkId,
  sanitizeHostedSiteCss,
  sanitizeHostedSiteHtml,
  sharedLinkPublicPath,
} from "@/lib/hosted-site"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"

describe("hosted site wrapper", () => {
  it("routes site ids to /site", () => {
    expect(isSiteLinkId("site_abc123def456")).toBe(true)
    expect(isSiteLinkId("pub_abc123def456")).toBe(false)
    expect(sharedLinkPublicPath("site_abc")).toBe("/site/site_abc")
    expect(sharedLinkPublicPath("emb_abc")).toBe("/embed/emb_abc")
    expect(sharedLinkPublicPath("pub_abc")).toBe("/run/pub_abc")
  })

  it("strips scripts and event handlers from custom HTML", () => {
    const dirty = `<h1 onclick="alert(1)">Hi</h1><script>steal()</script><img src="javascript:alert(1)">{{run}}`
    const clean = sanitizeHostedSiteHtml(dirty)
    expect(clean).not.toMatch(/script/i)
    expect(clean).not.toMatch(/onclick/i)
    expect(clean).not.toMatch(/javascript:/i)
    expect(clean).toContain(HOSTED_SITE_RUN_SLOT)
  })

  it("strips slash-prefixed event handlers", () => {
    const clean = sanitizeHostedSiteHtml(`<img/onerror="alert(1)" src="x">{{run}}`)
    expect(clean).not.toMatch(/onerror/i)
    expect(clean).toContain(HOSTED_SITE_RUN_SLOT)
  })

  it("strips CSS imports and expressions", () => {
    const css = sanitizeHostedSiteCss("@import url('https://evil'); body{background:expression(alert(1))}")
    expect(css).not.toMatch(/@import/)
    expect(css).not.toMatch(/expression/)
  })

  it("fills brand tokens and splits on the run slot", () => {
    const brand = { ...DEFAULT_HOSTED_SITE_OPTIONS.brand, companyName: "Acme <Co>", tagline: "Invoices" }
    const filled = applyHostedSiteTokens(DEFAULT_HOSTED_SITE_HTML, brand)
    expect(filled).toContain("Acme &lt;Co&gt;")
    expect(filled).toContain("Invoices")
    const parts = compileHostedSiteHtml({ ...DEFAULT_HOSTED_SITE_OPTIONS, brand, customHtml: DEFAULT_HOSTED_SITE_HTML })
    expect(parts.before).toContain("Acme")
    expect(parts.before).not.toContain(HOSTED_SITE_RUN_SLOT)
    expect(parts.after).toContain("</section>")
  })

  it("rejects unsafe logo urls", () => {
    expect(isSafeLogoUrl("https://cdn.example.com/logo.png")).toBe(true)
    expect(isSafeLogoUrl("javascript:alert(1)")).toBe(false)
    expect(isSafeLogoUrl("https://x.com/a.png onerror=alert(1)")).toBe(false)
  })
})
