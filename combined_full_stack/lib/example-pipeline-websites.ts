// AI : compact seed hostedSite specs expand into full HostedSiteOptions at load / clone.
import { compileHostedSiteLooksOk, normalizeHostedSiteOptions } from "@/lib/hosted-site"
import { escapeHtml } from "@/lib/standalone-html"
import { DEFAULT_WEBSITE_PIPELINE_ALIAS, listedWebsitePipelineBindings } from "@/lib/website-pipelines"
import type { HostedSiteOptions } from "@/lib/shared-link-types"
import type { ProjectId } from "@/lib/types"

export type example_website_feature = {
  kicker: string
  title: string
  body: string
}

const DEFAULT_FEATURES: example_website_feature[] = [
  {
    kicker: "01",
    title: "Typed in, typed out",
    body: "Upload work, run the attached pipeline, and read a structured result on this page.",
  },
  {
    kicker: "02",
    title: "Your brand, our host",
    body: "Colors, copy, and layout are yours. The pipeline behind the page stays the same.",
  },
  {
    kicker: "03",
    title: "Ready to re-skin",
    body: "Clone a second website onto the same pipeline when you need another brand.",
  },
]

export function exampleRunWebsiteHtml(opts: {
  kicker: string
  lede: string
  cta: string
  features?: example_website_feature[]
}): string {
  const features = (opts.features?.length ? opts.features : DEFAULT_FEATURES).slice(0, 3)
  const featureHtml = features
    .map(
      (f) => `<article class="hs-feature">
    <p class="hs-feature-kicker">${escapeHtml(f.kicker)}</p>
    <h2>${escapeHtml(f.title)}</h2>
    <p>${escapeHtml(f.body)}</p>
  </article>`,
    )
    .join("\n  ")
  return `<nav class="hs-nav">
  <div class="hs-nav-brand">
    {{logo}}
    <span class="hs-nav-name">{{company}}</span>
  </div>
  <div class="hs-nav-links">
    <a class="hs-nav-link" href="#run">Workspace</a>
    <span class="hs-nav-account">{{email}}</span>
  </div>
</nav>
<header class="hs-hero">
  <p class="hs-kicker">${escapeHtml(opts.kicker)}</p>
  <h1 class="hs-title">{{tagline}}</h1>
  <p class="hs-lede">${escapeHtml(opts.lede)}</p>
  <a class="hs-hero-cta" href="#run">${escapeHtml(opts.cta)}</a>
</header>
<section class="hs-features" aria-label="Product">
  ${featureHtml}
</section>
<section class="hs-run" id="run">
  <div class="hs-workspace-head">
    <p class="hs-kicker">Live workspace</p>
    <h2 class="hs-workspace-title">Run {{company}}</h2>
    <p class="hs-lede hs-lede-tight">Drop files in, run, and read the result in place.</p>
  </div>
{{run}}
</section>
<footer class="hs-footer">
  <span>{{company}}</span>
  <span class="hs-footer-meta">Hosted pipeline</span>
</footer>
`
}

function featureList(raw: unknown): example_website_feature[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: example_website_feature[] = []
  for (const row of raw.slice(0, 3)) {
    if (!row || typeof row !== "object") continue
    const rec = row as { kicker?: unknown; title?: unknown; body?: unknown }
    if (typeof rec.title !== "string" || typeof rec.body !== "string") continue
    out.push({
      kicker: typeof rec.kicker === "string" ? rec.kicker : String(out.length + 1).padStart(2, "0"),
      title: rec.title,
      body: rec.body,
    })
  }
  return out.length ? out : undefined
}

export function hostedSiteRawsFromSeed(raw: { hostedSite?: unknown; hostedSites?: unknown }): unknown[] {
  if (Array.isArray(raw.hostedSites) && raw.hostedSites.length) return raw.hostedSites.slice(0, 8)
  return raw.hostedSite != null ? [raw.hostedSite] : []
}

export function websiteNamesFromSeedRaw(raw: { hostedSite?: unknown; hostedSites?: unknown }): string[] {
  const names: string[] = []
  for (const site of hostedSiteRawsFromSeed(raw)) {
    if (!site || typeof site !== "object") continue
    const name = (site as { brand?: { companyName?: unknown } }).brand?.companyName
    if (typeof name === "string" && name.trim()) names.push(name.trim())
  }
  return names
}

// AI : JSON may be a full HostedSiteOptions blob or a compact kicker/lede/cta spec.
export function expandSeedHostedSite(raw: unknown, templateProjectId: ProjectId): HostedSiteOptions {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const authoredHtml = typeof o.customHtml === "string" ? o.customHtml.trim() : ""
  const customHtml =
    authoredHtml ||
    exampleRunWebsiteHtml({
      kicker: typeof o.kicker === "string" && o.kicker.trim() ? o.kicker : "Hosted workspace",
      lede: typeof o.lede === "string" ? o.lede : "",
      cta: typeof o.cta === "string" && o.cta.trim() ? o.cta : "Open workspace",
      features: featureList(o.features),
    })
  const options = normalizeHostedSiteOptions({
    brand: o.brand,
    customHtml,
    customCss: o.customCss,
    hideSpineFooter: o.hideSpineFooter,
    auth: o.auth,
    authHtml: o.authHtml,
    pages: o.pages,
    pipelineBindings: o.pipelineBindings,
    actions: o.actions,
    runtime: o.runtime,
    reactFiles: o.reactFiles,
  })
  const needsRunBinding =
    customHtml.includes("{{run") && listedWebsitePipelineBindings(options.pipelineBindings).length === 0
  if (!needsRunBinding) return options
  return {
    ...options,
    pipelineBindings: [{ alias: DEFAULT_WEBSITE_PIPELINE_ALIAS, projectId: templateProjectId }],
  }
}

export function expandSeedHostedSites(
  raw: { hostedSite?: unknown; hostedSites?: unknown },
  templateProjectId: ProjectId,
): HostedSiteOptions[] {
  return hostedSiteRawsFromSeed(raw).map((site) => expandSeedHostedSite(site, templateProjectId))
}

export function assertSeedHostedSitesCompile(sites: HostedSiteOptions[]): void {
  for (const site of sites) {
    const report = compileHostedSiteLooksOk(site)
    if (!report.ok) {
      const detail = report.issues.map((i) => `${i.level}:${i.code} ${i.message}`).join("\n")
      throw new Error(`hosted site ${site.brand.companyName || "(unnamed)"} failed compile:\n${detail}`)
    }
  }
}
