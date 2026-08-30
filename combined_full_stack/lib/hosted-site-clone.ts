// AI : open-lovable clone-from-URL without Firecrawl (MIT idea; our HTML parser + sanitizer).
import { lookup } from "node:dns/promises"
import {
  isSafeLogoUrl,
  normalizeHostedSiteOptions,
  parseHexColor,
  sanitizeHostedSiteHtml,
  type hex_color_string,
  type logo_url_string,
} from "@/lib/hosted-site"
import { DEFAULT_HOSTED_SITE_HTML, DEFAULT_HOSTED_SITE_LANDING_HTML } from "@/lib/hosted-site-defaults"
import { htmlSiteToReactFiles } from "@/lib/hosted-site-react"
import { HOSTED_SITE_RUN_SLOT } from "@/lib/hosted-site-slots"
import type { HostedSiteBrand, HostedSiteOptions } from "@/lib/shared-link-types"
import { escapeHtml } from "@/lib/standalone-html"

export type public_http_url = string & { __brand: "public_http_url" }
export type scraped_heading = string & { __brand: "scraped_heading" }

export type HostedSiteScrapeExtract = {
  url: public_http_url
  title: string
  description: string
  headings: scraped_heading[]
  paragraphs: string[]
  primaryColor: hex_color_string | null
  accentColor: hex_color_string | null
  logoUrl: logo_url_string | ""
}

const MAX_HTML_BYTES = 400_000
const FETCH_TIMEOUT_MS = 12_000
const MAX_REDIRECTS = 3

export class HostedSiteCloneError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "HostedSiteCloneError"
  }
}

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return false
  const oct = m.slice(1).map((n) => Number(n))
  if (oct.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b] = oct as [number, number]
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

function isBlockedIp(address: string): boolean {
  const ip = address.toLowerCase()
  if (ip === "::1" || ip === "::" || ip === "0.0.0.0") return true
  if (ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) return true
  if (ip.startsWith("::ffff:")) return isPrivateIpv4(ip.slice("::ffff:".length))
  return isPrivateIpv4(ip)
}

export function assertPublicHttpUrl(raw: string): public_http_url {
  const trimmed = raw.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new HostedSiteCloneError("Enter a valid http(s) URL")
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new HostedSiteCloneError("Only http and https URLs can be cloned")
  }
  if (parsed.username || parsed.password) {
    throw new HostedSiteCloneError("URLs with credentials cannot be cloned")
  }
  const host = parsed.hostname.toLowerCase()
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new HostedSiteCloneError("That host cannot be cloned")
  }
  if (isBlockedIp(host)) throw new HostedSiteCloneError("That host cannot be cloned")
  return parsed.toString() as public_http_url
}

export async function assertPublicHttpUrlResolved(raw: string): Promise<public_http_url> {
  const url = assertPublicHttpUrl(raw)
  const hostname = new URL(url).hostname
  if (isPrivateIpv4(hostname) || isBlockedIp(hostname)) {
    throw new HostedSiteCloneError("That host cannot be cloned")
  }
  try {
    const found = await lookup(hostname, { all: true })
    if (found.length === 0 || found.some((row) => isBlockedIp(row.address))) {
      throw new HostedSiteCloneError("That host cannot be cloned")
    }
  } catch (err) {
    if (err instanceof HostedSiteCloneError) throw err
    throw new HostedSiteCloneError("Could not resolve that host")
  }
  return url
}

function decodeEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
}

function metaContent(html: string, names: string[]): string {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["'][^>]*>`,
      "i",
    )
    const m = re.exec(html)
    const value = m?.[1] || m?.[2]
    if (value?.trim()) return decodeEntities(value)
  }
  return ""
}

function firstMatch(html: string, re: RegExp): string {
  const m = re.exec(html)
  return m?.[1] ? decodeEntities(m[1]) : ""
}

function collect(html: string, re: RegExp, max: number, minLen: number): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  re.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < max) {
    const text = stripTags(m[1] ?? "").slice(0, 240)
    if (text.length < minLen || seen.has(text.toLowerCase())) continue
    seen.add(text.toLowerCase())
    out.push(text)
  }
  return out
}

const SKIP_HEX = new Set(["#ffffff", "#fff", "#000000", "#000", "#111111", "#eeeeee"])

function extractHexColors(html: string): hex_color_string[] {
  const theme = metaContent(html, ["theme-color"])
  const found: hex_color_string[] = []
  const seen = new Set<string>()
  const consider = (raw: string) => {
    const parsed = parseHexColor(raw, "#000000" as hex_color_string)
    const key = parsed.toLowerCase()
    if (SKIP_HEX.has(key) || seen.has(key)) return
    seen.add(key)
    found.push(parsed)
  }
  if (theme) consider(theme)
  const hexRe = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi
  let m: RegExpExecArray | null
  while ((m = hexRe.exec(html)) && found.length < 6) consider(m[0]!)
  return found
}

export function extractHostedSiteScrape(html: string, sourceUrl: public_http_url): HostedSiteScrapeExtract {
  const title =
    firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ||
    metaContent(html, ["og:title", "twitter:title"]) ||
    firstMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i) ||
    new URL(sourceUrl).hostname
  const description =
    metaContent(html, ["description", "og:description", "twitter:description"]) ||
    firstMatch(html, /<p\b[^>]*>([\s\S]*?)<\/p>/i)
  const headings = collect(html, /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi, 6, 3) as scraped_heading[]
  const paragraphs = collect(html, /<p\b[^>]*>([\s\S]*?)<\/p>/gi, 4, 24)
  const colors = extractHexColors(html)
  const logoRaw =
    firstMatch(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    firstMatch(html, /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)
  let logoUrl = "" as logo_url_string | ""
  if (logoRaw) {
    try {
      const abs = new URL(logoRaw, sourceUrl).toString()
      if (isSafeLogoUrl(abs)) logoUrl = abs as logo_url_string
    } catch {
      logoUrl = ""
    }
  }
  return {
    url: sourceUrl,
    title: title.slice(0, 120),
    description: description.slice(0, 280),
    headings,
    paragraphs,
    primaryColor: colors[0] ?? null,
    accentColor: colors[1] ?? colors[0] ?? null,
    logoUrl,
  }
}

function featureCards(extract: HostedSiteScrapeExtract): string {
  const titles = extract.headings.filter((h) => h.toLowerCase() !== extract.title.toLowerCase()).slice(0, 3)
  const paras = extract.paragraphs
  const cards = [0, 1, 2].map((i) => {
    const heading = titles[i] || ["What it does", "How it looks", "Hosted for you"][i]!
    const body = paras[i] || paras[0] || "Vibe the rest of this page in chat. Pipeline widgets mount where you leave the slots."
    return `<article class="hs-feature">
    <p class="hs-feature-kicker">0${i + 1}</p>
    <h2>${escapeHtml(heading)}</h2>
    <p>${escapeHtml(body)}</p>
  </article>`
  })
  return `<section class="hs-features" aria-label="Product">
  ${cards.join("\n  ")}
</section>`
}

export function hostedHtmlFromScrape(extract: HostedSiteScrapeExtract, keepRun: boolean): string {
  const lede = extract.description || extract.paragraphs[0] || extract.title
  const run = keepRun
    ? `<section class="hs-run" id="run">
  <div class="hs-workspace-head">
    <p class="hs-kicker">Live workspace</p>
    <h2 class="hs-workspace-title">Run {{company}}</h2>
    <p class="hs-lede hs-lede-tight">Drop files in, run, and read the result in place.</p>
  </div>
${HOSTED_SITE_RUN_SLOT}
</section>`
    : ""
  const html = `<nav class="hs-nav">
  <div class="hs-nav-brand">
    {{logo}}
    <span class="hs-nav-name">{{company}}</span>
  </div>
  <div class="hs-nav-links">
    <a class="hs-nav-link" href="${keepRun ? "#run" : "#top"}">${keepRun ? "Workspace" : "Home"}</a>
    <span class="hs-nav-account">{{email}}</span>
  </div>
</nav>
<header class="hs-hero" id="top">
  <p class="hs-kicker">Cloned page</p>
  <h1 class="hs-title">{{tagline}}</h1>
  <p class="hs-lede">${escapeHtml(lede)}</p>
  ${keepRun ? `<a class="hs-hero-cta" href="#run">Open workspace</a>` : ""}
</header>
${featureCards(extract)}
${run}
<footer class="hs-footer">
  <span>{{company}}</span>
  <span class="hs-footer-meta">Rebuilt from ${escapeHtml(new URL(extract.url).hostname)}</span>
</footer>
`
  return sanitizeHostedSiteHtml(html.trim())
}

export function hostedSiteFromScrape(
  extract: HostedSiteScrapeExtract,
  current: HostedSiteOptions,
): HostedSiteOptions {
  const keepRun = current.pipelineBindings.length > 0 || current.customHtml.includes(HOSTED_SITE_RUN_SLOT)
  const brand: HostedSiteBrand = {
    ...current.brand,
    companyName: extract.title || current.brand.companyName,
    tagline: extract.description || extract.title || current.brand.tagline,
    logoUrl: extract.logoUrl || current.brand.logoUrl,
    primaryColor: extract.primaryColor ?? current.brand.primaryColor,
    accentColor: extract.accentColor ?? current.brand.accentColor,
  }
  const customHtml = hostedHtmlFromScrape(extract, keepRun) || (keepRun ? DEFAULT_HOSTED_SITE_HTML : DEFAULT_HOSTED_SITE_LANDING_HTML)
  const next = normalizeHostedSiteOptions({
    ...current,
    brand,
    customHtml,
  })
  if (current.runtime !== "react") return next
  return normalizeHostedSiteOptions({
    ...next,
    runtime: "react",
    reactFiles: htmlSiteToReactFiles(next),
  })
}

export function hostedSiteFromScrapedHtml(
  html: string,
  sourceUrl: string,
  current: HostedSiteOptions,
): { siteOptions: HostedSiteOptions; extracted: HostedSiteScrapeExtract } {
  const url = assertPublicHttpUrl(sourceUrl)
  const extracted = extractHostedSiteScrape(html, url)
  return { siteOptions: hostedSiteFromScrape(extracted, current), extracted }
}

async function fetchPublicHtml(url: public_http_url, fetchImpl: typeof fetch, hops = 0): Promise<string> {
  if (hops > MAX_REDIRECTS) throw new HostedSiteCloneError("Too many redirects")
  const res = await fetchImpl(url, {
    method: "GET",
    redirect: "manual",
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "SpineHostedSiteClone/1.0" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location")
    if (!location) throw new HostedSiteCloneError("Redirect missing Location")
    const next = assertPublicHttpUrl(new URL(location, url).toString())
    await assertPublicHttpUrlResolved(next)
    return fetchPublicHtml(next, fetchImpl, hops + 1)
  }
  if (!res.ok) throw new HostedSiteCloneError(`Could not fetch that page (${res.status})`)
  const type = (res.headers.get("content-type") ?? "").toLowerCase()
  if (type && !type.includes("text/html") && !type.includes("application/xhtml")) {
    throw new HostedSiteCloneError("That URL is not an HTML page")
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength > MAX_HTML_BYTES) throw new HostedSiteCloneError("That page is too large to clone")
  return buf.toString("utf8")
}

export async function cloneHostedSiteFromUrl(
  rawUrl: string,
  current: HostedSiteOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<{ siteOptions: HostedSiteOptions; extracted: HostedSiteScrapeExtract }> {
  const url = await assertPublicHttpUrlResolved(rawUrl)
  const html = await fetchPublicHtml(url, fetchImpl)
  return hostedSiteFromScrapedHtml(html, url, current)
}
