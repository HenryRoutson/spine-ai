import { escapeHtml } from "@/lib/standalone-html"
import type { HostedSiteBrand, HostedSiteOptions } from "@/lib/shared-link-types"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"

export type hex_color_string = string & { __brand: "hex_color" }
export type logo_url_string = string & { __brand: "logo_url" }

export const HOSTED_SITE_RUN_SLOT = "{{run}}"
export const SITE_LINK_PREFIX = "site_"

const HEX6_RE = /^#[0-9a-f]{6}$/i
const HEX3_RE = /^#([0-9a-f]{3})$/i
const LOGO_URL_RE = /^(https?:\/\/[^\s]+|data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+)$/i

export function isSiteLinkId(id: string): boolean {
  return /^site_/i.test(id)
}

export function sharedLinkPublicPath(id: string): string {
  if (isSiteLinkId(id)) return `/site/${id}`
  if (/^emb_/i.test(id)) return `/embed/${id}`
  return `/run/${id}`
}

// AI : <input type="color"> only accepts #rrggbb — expand #abc so pickers and Zod stay in sync.
export function expandHexColor(raw: string): hex_color_string | null {
  const v = raw.trim()
  const short = HEX3_RE.exec(v)
  if (short) {
    const digits = short[1]
    if (digits && digits.length === 3) {
      return `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}` as hex_color_string
    }
  }
  return HEX6_RE.test(v) ? (v as hex_color_string) : null
}

export function isHexColor(raw: string): raw is hex_color_string {
  return expandHexColor(raw) !== null
}

export function parseHexColor(raw: string, fallback: hex_color_string): hex_color_string {
  return expandHexColor(raw) ?? fallback
}

export function htmlColorInputValue(raw: string, fallback: string): string {
  return expandHexColor(raw) ?? expandHexColor(fallback) ?? "#000000"
}

export function isSafeLogoUrl(raw: string): raw is logo_url_string {
  const v = raw.trim()
  return v.length > 0 && v.length <= 2048 && LOGO_URL_RE.test(v)
}

export const DEFAULT_HOSTED_SITE_HTML = `<header class="hs-hero">
  {{logo}}
  <p class="hs-kicker">{{company}}</p>
  <h1 class="hs-title">{{tagline}}</h1>
</header>
<section class="hs-run">
${HOSTED_SITE_RUN_SLOT}
</section>
`

export function defaultHostedSiteCss(): string {
  return `
.hs-root { min-height: 100dvh; background: var(--hs-bg); color: var(--hs-fg); }
.hs-hero { padding: 2.5rem 1.5rem 1.5rem; text-align: center; }
.hs-logo { display: block; height: 2.5rem; margin: 0 auto 1rem; object-fit: contain; }
.hs-kicker { margin: 0; font-size: 0.75rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--hs-accent); }
.hs-title { margin: 0.5rem auto 0; max-width: 36rem; font-size: clamp(1.4rem, 3vw, 2rem); line-height: 1.25; font-weight: 650; }
.hs-run { padding: 0 1rem 2.5rem; }
.hs-run-slot { margin: 0 auto; max-width: 56rem; border-radius: 1rem; overflow: hidden; box-shadow: 0 18px 50px color-mix(in srgb, var(--hs-fg) 12%, transparent); background: #fff; color: inherit; }
.hs-foot { padding: 0 1.5rem 2rem; text-align: center; font-size: 0.7rem; opacity: 0.55; }
.hs-foot a { color: inherit; }
`
}

export function hostedSiteBrandVars(brand: HostedSiteBrand): Record<string, string> {
  return {
    ["--hs-bg"]: brand.backgroundColor,
    ["--hs-fg"]: brand.textColor,
    ["--hs-primary"]: brand.primaryColor,
    ["--hs-accent"]: brand.accentColor,
  }
}

export function sanitizeHostedSiteCss(css: string): string {
  return css
    .replace(/<\/style/gi, "")
    .replace(/@import\b/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/-moz-binding/gi, "")
    .slice(0, 20_000)
}

export function sanitizeHostedSiteHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?script\b[^>]*>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<(object|embed|applet|link|meta|base|form|textarea|input|button|select|svg|math)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(object|embed|applet|link|meta|base|form|textarea|input|button|select|svg|math)[^>]*\/?>/gi, "")
    .replace(/([<\s/])on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "$1")
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/data:\s*text\/html/gi, "")
    .replace(/\s(href|src|xlink:href)\s*=\s*(['"])\s*(javascript:|data:text)[^'"]*\2/gi, "")
    .slice(0, 50_000)
}

export function applyHostedSiteTokens(html: string, brand: HostedSiteBrand): string {
  const name = escapeHtml(brand.companyName.trim() || "Your company")
  const tagline = escapeHtml(brand.tagline.trim() || "Run this pipeline")
  const logo = isSafeLogoUrl(brand.logoUrl)
    ? `<img class="hs-logo" src="${escapeHtml(brand.logoUrl.trim())}" alt="${name}" />`
    : ""
  return html
    .replaceAll("{{company}}", name)
    .replaceAll("{{tagline}}", tagline)
    .replaceAll("{{logo}}", logo)
}

export type HostedSiteHtmlParts = {
  before: string
  after: string
  css: string
}

export type HostedSiteLookIssue = {
  level: "error" | "warn"
  code: string
  message: string
}

export type HostedSiteCompileReport = {
  ok: boolean
  parts: HostedSiteHtmlParts
  pageHtml: string
  issues: HostedSiteLookIssue[]
}

const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
const BODY_INNER_RE = /<body\b[^>]*>([\s\S]*?)<\/body>/i
const DOCUMENT_CHROME_RE = /<\/?(html|head|body)\b[^>]*>/gi
const LOOK_CONTAINER_TAGS = ["nav", "header", "section", "main", "footer", "article", "aside", "div", "ul", "ol"] as const

// AI : Lovable dumps a full document; Spine mounts HTML inside a div, so keep body + extracted CSS only.
export function unwrapVibeCodedHtml(html: string): { html: string; cssFromHtml: string } {
  let cssFromHtml = ""
  const withoutStyle = html.replace(STYLE_BLOCK_RE, (_full, css: string) => {
    cssFromHtml += `${css}\n`
    return ""
  })
  const body = withoutStyle.match(BODY_INNER_RE)
  const inner = (body ? body[1] : withoutStyle)
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(DOCUMENT_CHROME_RE, "")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
  return { html: inner.trim(), cssFromHtml: cssFromHtml.trim() }
}

export function compileHostedSiteHtml(options: HostedSiteOptions): HostedSiteHtmlParts {
  const brand = options.brand
  const unwrapped = unwrapVibeCodedHtml(options.customHtml.trim() || DEFAULT_HOSTED_SITE_HTML)
  const html = applyHostedSiteTokens(sanitizeHostedSiteHtml(unwrapped.html), brand)
  const splitAt = html.indexOf(HOSTED_SITE_RUN_SLOT)
  const before = splitAt < 0 ? html : html.slice(0, splitAt)
  const after = splitAt < 0 ? "" : html.slice(splitAt + HOSTED_SITE_RUN_SLOT.length)
  const css = `${defaultHostedSiteCss()}\n${sanitizeHostedSiteCss(unwrapped.cssFromHtml)}\n${sanitizeHostedSiteCss(options.customCss)}`
  return { before, after, css }
}

export function compileHostedSiteLooksOk(options: HostedSiteOptions): HostedSiteCompileReport {
  const issues: HostedSiteLookIssue[] = []
  let parts: HostedSiteHtmlParts
  try {
    parts = compileHostedSiteHtml(options)
  } catch (err) {
    parts = { before: "", after: "", css: "" }
    issues.push({
      level: "error",
      code: "compile-throw",
      message: err instanceof Error ? err.message : String(err),
    })
  }

  const company = escapeHtml(options.brand.companyName.trim() || "Your company")
  const vars = hostedSiteBrandVars(options.brand)
  const styleAttr = Object.entries(vars)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ")
  const pageHtml = `<div class="hs-root" style="${styleAttr}"><style>${parts.css}</style>${parts.before}<div class="hs-run-slot"></div>${parts.after}${options.hideSpineFooter ? "" : `<p class="hs-foot">${company}</p>`}</div>`
  const markup = `${parts.before}${parts.after}`
  const unwrapped = unwrapVibeCodedHtml(options.customHtml.trim() || DEFAULT_HOSTED_SITE_HTML)
  const runCount = sanitizeHostedSiteHtml(unwrapped.html).split(HOSTED_SITE_RUN_SLOT).length - 1

  if (!markup.trim()) {
    issues.push({ level: "error", code: "empty-html", message: "compiled HTML is empty" })
  }
  if (/<!doctype|<html\b|<head\b|<body\b/i.test(markup)) {
    issues.push({ level: "error", code: "document-chrome", message: "full document tags leaked into the hosted page" })
  }
  if (/<script\b|javascript:/i.test(pageHtml)) {
    issues.push({ level: "error", code: "script", message: "script or javascript: survived compile" })
  }
  if (parts.before.includes(HOSTED_SITE_RUN_SLOT) || parts.after.includes(HOSTED_SITE_RUN_SLOT)) {
    issues.push({ level: "error", code: "run-slot-leftover", message: "{{run}} leftover after split" })
  }
  if (runCount === 0) {
    issues.push({ level: "warn", code: "run-slot-missing", message: "no {{run}} slot; pipeline form is appended" })
  } else if (runCount > 1) {
    issues.push({ level: "error", code: "run-slot-duplicate", message: "multiple {{run}} slots" })
  }
  const leftoverTokens = markup.match(/\{\{[a-z]+\}\}/gi) ?? []
  if (leftoverTokens.length) {
    issues.push({ level: "error", code: "token-leftover", message: `unreplaced tokens: ${leftoverTokens.join(", ")}` })
  }
  if (!pageHtml.includes("hs-run-slot") || !parts.css.includes(".hs-root") || !parts.css.includes(".hs-run-slot")) {
    issues.push({ level: "error", code: "chrome-missing", message: "hosted chrome CSS or run slot missing" })
  }
  if (!pageHtml.includes("--hs-bg") || !pageHtml.includes(options.brand.backgroundColor)) {
    issues.push({ level: "error", code: "brand-vars", message: "brand CSS variables missing" })
  }
  if (options.brand.companyName.trim() && !pageHtml.includes(company)) {
    issues.push({ level: "warn", code: "company-missing", message: "company name not visible in compiled HTML" })
  }
  const cssOpens = (parts.css.match(/{/g) ?? []).length
  const cssCloses = (parts.css.match(/}/g) ?? []).length
  if (cssOpens !== cssCloses) {
    issues.push({ level: "error", code: "css-braces", message: `CSS braces unbalanced (${cssOpens} vs ${cssCloses})` })
  }
  for (const tag of LOOK_CONTAINER_TAGS) {
    const open = (markup.match(new RegExp(`<${tag}\\b`, "gi")) ?? []).length
    const close = (markup.match(new RegExp(`</${tag}>`, "gi")) ?? []).length
    if (open !== close) {
      issues.push({ level: "warn", code: "tag-balance", message: `<${tag}> open ${open} close ${close}` })
    }
  }
  if (!/<h[1-3]\b|hs-title/i.test(markup)) {
    issues.push({ level: "warn", code: "no-heading", message: "no heading in compiled HTML" })
  }

  return { ok: issues.every((issue) => issue.level !== "error"), parts, pageHtml, issues }
}

export function normalizeHostedSiteBrand(raw: unknown): HostedSiteBrand {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<HostedSiteBrand>
  const d = DEFAULT_HOSTED_SITE_OPTIONS.brand
  return {
    companyName: typeof o.companyName === "string" ? o.companyName.slice(0, 80) : d.companyName,
    tagline: typeof o.tagline === "string" ? o.tagline.slice(0, 200) : d.tagline,
    logoUrl: typeof o.logoUrl === "string" && isSafeLogoUrl(o.logoUrl) ? o.logoUrl.trim() : "",
    primaryColor: parseHexColor(typeof o.primaryColor === "string" ? o.primaryColor : "", d.primaryColor as hex_color_string),
    accentColor: parseHexColor(typeof o.accentColor === "string" ? o.accentColor : "", d.accentColor as hex_color_string),
    backgroundColor: parseHexColor(typeof o.backgroundColor === "string" ? o.backgroundColor : "", d.backgroundColor as hex_color_string),
    textColor: parseHexColor(typeof o.textColor === "string" ? o.textColor : "", d.textColor as hex_color_string),
  }
}

export function normalizeHostedSiteOptions(raw: unknown): HostedSiteOptions {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<HostedSiteOptions>
  return {
    brand: normalizeHostedSiteBrand(o.brand),
    customHtml: typeof o.customHtml === "string" ? o.customHtml.slice(0, 50_000) : "",
    customCss: typeof o.customCss === "string" ? o.customCss.slice(0, 20_000) : "",
    hideSpineFooter: o.hideSpineFooter === true,
  }
}

// AI : vibe response is a full snapshot of what was sent — keep fields the user edited while the LLM ran.
export function keepConcurrentHostedSiteEdits(
  sent: HostedSiteOptions,
  received: HostedSiteOptions,
  latest: HostedSiteOptions,
): HostedSiteOptions {
  const pickBrand = <K extends keyof HostedSiteBrand>(key: K): HostedSiteBrand[K] =>
    received.brand[key] !== sent.brand[key] ? received.brand[key] : latest.brand[key]
  return {
    brand: {
      companyName: pickBrand("companyName"),
      tagline: pickBrand("tagline"),
      logoUrl: pickBrand("logoUrl"),
      primaryColor: pickBrand("primaryColor"),
      accentColor: pickBrand("accentColor"),
      backgroundColor: pickBrand("backgroundColor"),
      textColor: pickBrand("textColor"),
    },
    customHtml: received.customHtml !== sent.customHtml ? received.customHtml : latest.customHtml,
    customCss: received.customCss !== sent.customCss ? received.customCss : latest.customCss,
    hideSpineFooter:
      received.hideSpineFooter !== sent.hideSpineFooter ? received.hideSpineFooter : latest.hideSpineFooter,
  }
}
