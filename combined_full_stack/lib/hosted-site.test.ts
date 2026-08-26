import { describe, expect, it } from "vitest"
import {
  applyHostedSiteTokens,
  compileHostedSiteAuthHtml,
  compileHostedSiteHtml,
  compileHostedSiteLooksOk,
  DEFAULT_HOSTED_SITE_HTML,
  expandHexColor,
  HOSTED_SITE_AUTH_SLOT,
  HOSTED_SITE_RUN_SLOT,
  htmlColorInputValue,
  isSafeLogoUrl,
  isSiteLinkId,
  keepConcurrentHostedSiteEdits,
  normalizeHostedSiteOptions,
  parseHexColor,
  sanitizeHostedSiteCss,
  sanitizeHostedSiteHtml,
  sharedLinkPublicPath,
  type hex_color_string,
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

  it("strips entity-encoded javascript: and null-byte handlers", () => {
    const encoded = sanitizeHostedSiteHtml(`<a href="&#106;avascript:alert(1)">x</a>{{run}}`)
    expect(encoded).not.toMatch(/javascript:/i)
    expect(encoded).not.toMatch(/alert\(1\)/i)
    const hex = sanitizeHostedSiteHtml(`<a href="&#x6a;avascript:alert(1)">x</a>{{run}}`)
    expect(hex).not.toMatch(/javascript:/i)
    const nul = sanitizeHostedSiteHtml(`<img onerror\0="alert(1)" src="x">{{run}}`)
    expect(nul).not.toMatch(/onerror/i)
    expect(nul).not.toMatch(/alert\(1\)/i)
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
    expect(filled).toContain("you@company.com")
    expect(filled).toContain("hs-nav-account")
    expect(filled).not.toMatch(/href="#signin"/)
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

  it("expands 3-digit hex so color inputs get #rrggbb", () => {
    expect(expandHexColor("#abc")).toBe("#aabbcc")
    expect(expandHexColor("#AABBCC")).toBe("#AABBCC")
    expect(expandHexColor("#ff0")).toBe("#ffff00")
    expect(expandHexColor("#gggggg")).toBeNull()
    expect(parseHexColor("#0f0", "#111827" as hex_color_string)).toBe("#00ff00")
    expect(htmlColorInputValue("#f00", "#111827")).toBe("#ff0000")
    expect(htmlColorInputValue("nope", "#111827")).toBe("#111827")
  })

  it("keeps concurrent hosted-site edits the assistant did not touch", () => {
    const sent = {
      ...DEFAULT_HOSTED_SITE_OPTIONS,
      brand: { ...DEFAULT_HOSTED_SITE_OPTIONS.brand, companyName: "Acme", tagline: "Old" },
      customHtml: "<p>{{run}}</p>",
      customCss: ".a{}",
    }
    const received = {
      ...sent,
      customHtml: "<header>{{run}}</header>",
      brand: { ...sent.brand, primaryColor: "#ff0000" },
    }
    const latest = {
      ...sent,
      customCss: ".user{}",
      brand: { ...sent.brand, tagline: "Typed during wait" },
    }
    const merged = keepConcurrentHostedSiteEdits(sent, received, latest)
    expect(merged.customHtml).toBe("<header>{{run}}</header>")
    expect(merged.brand.primaryColor).toBe("#ff0000")
    expect(merged.customCss).toBe(".user{}")
    expect(merged.brand.tagline).toBe("Typed during wait")
    expect(merged.brand.companyName).toBe("Acme")
  })

  it("fills a professional default page and compiles a sign-in surface", () => {
    const brand = { ...DEFAULT_HOSTED_SITE_OPTIONS.brand, companyName: "Acme", tagline: "Workspace" }
    const app = compileHostedSiteHtml({ ...DEFAULT_HOSTED_SITE_OPTIONS, brand, customHtml: DEFAULT_HOSTED_SITE_HTML })
    expect(app.before).toContain("hs-nav")
    expect(app.before).toContain("hs-features")
    expect(app.before).toContain("hs-nav-account")
    expect(app.before).toContain("you@company.com")
    expect(app.before).not.toMatch(/href="#signin"/)
    expect(app.before).not.toMatch(/>Sign in</)
    expect(DEFAULT_HOSTED_SITE_OPTIONS.auth.enabled).toBe(false)
    expect(app.before).not.toContain(HOSTED_SITE_RUN_SLOT)
    const signedIn = compileHostedSiteLooksOk({
      ...DEFAULT_HOSTED_SITE_OPTIONS,
      brand,
      customHtml: DEFAULT_HOSTED_SITE_HTML,
      auth: { ...DEFAULT_HOSTED_SITE_OPTIONS.auth, enabled: true },
    })
    expect(signedIn.ok, signedIn.issues.map((i) => `${i.level}:${i.code} ${i.message}`).join("\n")).toBe(true)
    const authParts = compileHostedSiteAuthHtml({
      ...DEFAULT_HOSTED_SITE_OPTIONS,
      brand,
      auth: { ...DEFAULT_HOSTED_SITE_OPTIONS.auth, enabled: true },
    })
    expect(authParts.before).toContain("Sign in")
    expect(authParts.before).toContain("Acme")
    expect(authParts.before).not.toContain(HOSTED_SITE_AUTH_SLOT)
  })

  it("splits extra widget slots and still compiles", () => {
    const brand = { ...DEFAULT_HOSTED_SITE_OPTIONS.brand, companyName: "Acme", tagline: "Invoices" }
    const html = `<header><h1>{{tagline}}</h1></header>{{docs}}{{run}}{{output}}{{chatbot}}`
    const parts = compileHostedSiteHtml({ ...DEFAULT_HOSTED_SITE_OPTIONS, brand, customHtml: html })
    expect(parts.segments.filter((s) => s.kind === "slot").map((s) => (s.kind === "slot" ? s.slot : ""))).toEqual([
      "docs",
      "run",
      "output",
      "chatbot",
    ])
    const report = compileHostedSiteLooksOk({ ...DEFAULT_HOSTED_SITE_OPTIONS, brand, customHtml: html })
    expect(report.ok, report.issues.map((i) => `${i.level}:${i.code} ${i.message}`).join("\n")).toBe(true)
    expect(report.pageHtml).toContain("hs-output-slot")
    expect(report.pageHtml).toContain("hs-chatbot-slot")
    expect(report.pageHtml).toContain("hs-docs-slot")
  })

  it("normalizes extra pages and skips reserved paths", () => {
    const next = normalizeHostedSiteOptions({
      pages: [
        { path: "/app", html: "<p>{{run}}</p>" },
        { path: "index", html: "nope" },
        { path: "APP", html: "dup" },
      ],
    })
    expect(next.pages).toEqual([{ path: "app", html: "<p>{{run}}</p>" }])
  })
})
