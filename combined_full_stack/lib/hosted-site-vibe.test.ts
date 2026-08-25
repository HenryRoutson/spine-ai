import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { HostedSiteChrome } from "@/components/share/hosted-site-chrome"
import {
  compileHostedSiteHtml,
  compileHostedSiteLooksOk,
  DEFAULT_HOSTED_SITE_HTML,
  HOSTED_SITE_RUN_SLOT,
  normalizeHostedSiteOptions,
  unwrapVibeCodedHtml,
} from "@/lib/hosted-site"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"

const VIBE_BRAND = {
  ...DEFAULT_HOSTED_SITE_OPTIONS.brand,
  companyName: "Northwind AI",
  tagline: "Invoice ops in one click",
  logoUrl: "https://cdn.example.com/northwind.svg",
  primaryColor: "#0f172a",
  accentColor: "#7c3aed",
  backgroundColor: "#f8fafc",
  textColor: "#0f172a",
}

// AI : typical Lovable dump — full document, <style>, scripts, nav/hero/features around {{run}}.
const LOVABLE_LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{{company}}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root { --brand: #7c3aed; }
    @import url("https://fonts.googleapis.com/css2?family=Inter");
    .nav { display: flex; justify-content: space-between; padding: 1rem 1.5rem; align-items: center; }
    .hero { padding: 4rem 1.5rem 2rem; text-align: center; background: linear-gradient(180deg, #fff, #f1f5f9); }
    .features { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; padding: 0 1.5rem 2rem; }
    .cta { display: inline-block; padding: 0.7rem 1.1rem; border-radius: 999px; background: var(--brand); color: #fff; }
    body { color: #0f172a; }
  </style>
</head>
<body>
  <nav class="nav">
    {{logo}}
    <span class="brand">{{company}}</span>
    <a class="cta" href="#run">Open app</a>
  </nav>
  <header class="hero">
    <p class="eyebrow">AI workspace</p>
    <h1>{{tagline}}</h1>
    <p>Paste work in and get a branded result — no website to host.</p>
    <a class="cta" href="#run">Try it</a>
  </header>
  <section class="features">
    <article><h2>Fast</h2><p>Runs on Spine.</p></article>
    <article><h2>Yours</h2><p>Your colors and copy.</p></article>
    <article><h2>Private</h2><p>No extra database.</p></article>
  </section>
  <main id="run">
    ${HOSTED_SITE_RUN_SLOT}
  </main>
  <footer>
    <p>© {{company}}</p>
  </footer>
  <script>window.analytics = true</script>
</body>
</html>
`

const LOVABLE_CUSTOM_CSS = `
.hs-run-slot { border: 1px solid color-mix(in srgb, var(--hs-accent) 35%, transparent); }
.eyebrow { letter-spacing: 0.14em; text-transform: uppercase; font-size: 0.72rem; color: var(--hs-accent); }
`

function vibeOptions(overrides: { customHtml?: string; customCss?: string; hideSpineFooter?: boolean } = {}) {
  return normalizeHostedSiteOptions({
    brand: VIBE_BRAND,
    customHtml: overrides.customHtml ?? LOVABLE_LANDING_HTML,
    customCss: overrides.customCss ?? LOVABLE_CUSTOM_CSS,
    hideSpineFooter: overrides.hideSpineFooter,
  })
}

function errorCodes(report: ReturnType<typeof compileHostedSiteLooksOk>): string[] {
  return report.issues.filter((issue) => issue.level === "error").map((issue) => issue.code)
}

describe("lovable-style vibe HTML compile", () => {
  it("unwraps a full document into body markup plus extracted CSS", () => {
    const unwrapped = unwrapVibeCodedHtml(LOVABLE_LANDING_HTML)
    expect(unwrapped.html).not.toMatch(/<!doctype|<html\b|<head\b|<body\b|<style\b/i)
    expect(unwrapped.html).toContain(HOSTED_SITE_RUN_SLOT)
    expect(unwrapped.html).toContain("{{company}}")
    expect(unwrapped.cssFromHtml).toContain(".hero")
    expect(unwrapped.cssFromHtml).toContain(".features")
  })

  it("compiles a vibe-coded landing page without throwing", () => {
    const options = vibeOptions()
    expect(() => compileHostedSiteHtml(options)).not.toThrow()
    const parts = compileHostedSiteHtml(options)
    expect(parts.before.length).toBeGreaterThan(80)
    expect(parts.after).toContain("footer")
    expect(parts.css).toContain(".hs-root")
    expect(parts.css).toContain(".hs-run-slot")
  })

  it("looks ok: brand, run slot, layout, and no document chrome", () => {
    const report = compileHostedSiteLooksOk(vibeOptions())
    expect(errorCodes(report), report.issues.map((i) => `${i.level}:${i.code} ${i.message}`).join("\n")).toEqual([])
    expect(report.ok).toBe(true)
    expect(report.pageHtml).toContain("Northwind AI")
    expect(report.pageHtml).toContain("Invoice ops in one click")
    expect(report.pageHtml).toContain('class="hs-run-slot"')
    expect(report.pageHtml).toContain("--hs-accent: #7c3aed")
    expect(report.parts.before).toContain("class=\"nav\"")
    expect(report.parts.before).toContain("class=\"hero\"")
    expect(report.parts.before).toContain("class=\"features\"")
    expect(report.parts.before).toContain("hs-logo")
    expect(report.parts.before).not.toContain(HOSTED_SITE_RUN_SLOT)
    expect(report.parts.after).toContain("</main>")
    expect(report.parts.after).toContain("©")
    expect(report.pageHtml).not.toMatch(/<script\b/i)
    expect(report.pageHtml).not.toMatch(/<!doctype|<html\b|<head\b|<body\b/i)
  })

  it("keeps vibe CSS classes and strips dangerous CSS from <style>", () => {
    const parts = compileHostedSiteHtml(vibeOptions())
    expect(parts.css).toContain(".nav")
    expect(parts.css).toContain(".cta")
    expect(parts.css).toContain(".eyebrow")
    expect(parts.css).not.toMatch(/@import/)
    expect(parts.css).not.toMatch(/expression\s*\(/)
  })

  it("strips scripts and handlers from vibe HTML but keeps the page", () => {
    const dirty = LOVABLE_LANDING_HTML.replace(
      "<h1>{{tagline}}</h1>",
      `<h1 onclick="alert(1)">{{tagline}}</h1><img src="javascript:alert(1)">`,
    )
    const report = compileHostedSiteLooksOk(vibeOptions({ customHtml: dirty }))
    expect(report.ok).toBe(true)
    expect(report.pageHtml).not.toMatch(/onclick/i)
    expect(report.pageHtml).not.toMatch(/javascript:/i)
    expect(report.parts.before).toContain("Invoice ops in one click")
  })

  it("still looks ok when vibe forgets {{run}} (form is appended)", () => {
    const html = LOVABLE_LANDING_HTML.replace(HOSTED_SITE_RUN_SLOT, "")
    const report = compileHostedSiteLooksOk(vibeOptions({ customHtml: html }))
    expect(report.ok).toBe(true)
    expect(report.issues.some((issue) => issue.code === "run-slot-missing")).toBe(true)
    expect(report.pageHtml).toContain("hs-run-slot")
    expect(report.parts.after).toBe("")
  })

  it("rejects duplicate {{run}} slots as not looking ok", () => {
    const html = LOVABLE_LANDING_HTML.replace(
      "<footer>",
      `<section class="again">${HOSTED_SITE_RUN_SLOT}</section>\n  <footer>`,
    )
    const report = compileHostedSiteLooksOk(vibeOptions({ customHtml: html }))
    expect(report.ok).toBe(false)
    expect(errorCodes(report)).toContain("run-slot-duplicate")
  })

  it("escapes brand tokens from vibe copy", () => {
    const options = normalizeHostedSiteOptions({
      brand: { ...VIBE_BRAND, companyName: "Acme <Co>", tagline: "Run & done" },
      customHtml: LOVABLE_LANDING_HTML,
    })
    const report = compileHostedSiteLooksOk(options)
    expect(report.ok).toBe(true)
    expect(report.parts.before).toContain("Acme &lt;Co&gt;")
    expect(report.parts.before).toContain("Run &amp; done")
    expect(report.parts.before).not.toContain("Acme <Co>")
  })

  it("default template still compiles and looks ok", () => {
    const report = compileHostedSiteLooksOk(
      normalizeHostedSiteOptions({
        brand: VIBE_BRAND,
        customHtml: DEFAULT_HOSTED_SITE_HTML,
      }),
    )
    expect(report.ok).toBe(true)
    expect(report.parts.before).toContain("hs-hero")
    expect(report.parts.after).toContain("</section>")
  })

  it("renders HostedSiteChrome around vibe HTML with the pipeline slot in the middle", () => {
    const html = renderToStaticMarkup(
      createElement(
        HostedSiteChrome,
        { options: vibeOptions() },
        createElement("div", { "data-pipeline": "run" }, "pipeline form"),
      ),
    )
    expect(html).toContain("hs-root")
    expect(html).toContain("Northwind AI")
    expect(html).toContain("Invoice ops in one click")
    expect(html).toContain("hs-run-slot")
    expect(html).toContain("pipeline form")
    expect(html).toContain("--hs-accent")
    expect(html.indexOf("Open app")).toBeGreaterThan(-1)
    expect(html.indexOf("Open app")).toBeLessThan(html.indexOf("pipeline form"))
    expect(html.indexOf("pipeline form")).toBeLessThan(html.indexOf("©"))
    expect(html).not.toMatch(/<script\b/i)
    expect(html).not.toMatch(/<!doctype|<html\b|<head\b|<body\b/i)
  })
})

describe("hosted site vibe payload normalize", () => {
  it("round-trips a Lovable-style siteOptions body into a compiling page", () => {
    const options = normalizeHostedSiteOptions({
      brand: {
        companyName: VIBE_BRAND.companyName,
        tagline: VIBE_BRAND.tagline,
        logoUrl: VIBE_BRAND.logoUrl,
        primaryColor: VIBE_BRAND.primaryColor,
        accentColor: VIBE_BRAND.accentColor,
        backgroundColor: VIBE_BRAND.backgroundColor,
        textColor: VIBE_BRAND.textColor,
      },
      customHtml: LOVABLE_LANDING_HTML,
      customCss: LOVABLE_CUSTOM_CSS,
      hideSpineFooter: false,
    })
    const report = compileHostedSiteLooksOk(options)
    expect(options.brand.companyName).toBe("Northwind AI")
    expect(report.ok).toBe(true)
  })

  it("falls back unsafe vibe colors and still looks ok", () => {
    const options = normalizeHostedSiteOptions({
      brand: {
        companyName: VIBE_BRAND.companyName,
        primaryColor: "purple",
        accentColor: "rgb(0,0,0)",
        backgroundColor: "#f8fafc",
        textColor: "#0f172a",
      },
      customHtml: LOVABLE_LANDING_HTML,
    })
    expect(options.brand.primaryColor).toBe(DEFAULT_HOSTED_SITE_OPTIONS.brand.primaryColor)
    expect(options.brand.accentColor).toBe(DEFAULT_HOSTED_SITE_OPTIONS.brand.accentColor)
    expect(compileHostedSiteLooksOk(options).ok).toBe(true)
  })
})
