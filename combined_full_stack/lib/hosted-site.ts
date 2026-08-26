import { escapeHtml } from "@/lib/standalone-html"
import { DEFAULT_HOSTED_SITE_AUTH_HTML, DEFAULT_HOSTED_SITE_HTML, defaultHostedSiteCss } from "@/lib/hosted-site-defaults"
import { HOSTED_SITE_AUTH_SLOT, HOSTED_SITE_RUN_SLOT } from "@/lib/hosted-site-slots"
import type { HostedSiteAuth, HostedSiteAuthProvider, HostedSiteBrand, HostedSiteOptions } from "@/lib/shared-link-types"
import { DEFAULT_HOSTED_SITE_AUTH, DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"

export type hex_color_string = string & { __brand: "hex_color" }
export type logo_url_string = string & { __brand: "logo_url" }
export type hosted_site_surface = "app" | "signin"
export type hosted_site_viewport = "desktop" | "mobile"

export { DEFAULT_HOSTED_SITE_AUTH_HTML, DEFAULT_HOSTED_SITE_HTML, defaultHostedSiteCss } from "@/lib/hosted-site-defaults"
export { HOSTED_SITE_AUTH_SLOT, HOSTED_SITE_RUN_SLOT } from "@/lib/hosted-site-slots"

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
  const short = HEX3_RE.exec(v)?.[1]
  if (short) {
    return `#${short[0]}${short[0]}${short[1]}${short[1]}${short[2]}${short[2]}` as hex_color_string
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

export function hostedSiteBrandVars(brand: HostedSiteBrand): Record<string, string> {
  return {
    ["--hs-bg"]: brand.backgroundColor,
    ["--hs-fg"]: brand.textColor,
    ["--hs-primary"]: brand.primaryColor,
    ["--hs-accent"]: brand.accentColor,
  }
}

// AI : decode numeric / protocol entities so javascript: and handlers cannot hide behind &#106; or &#0;.
function decodeHostedMarkup(raw: string): string {
  let s = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
  for (let i = 0; i < 3; i++) {
    const next = s
      .replace(/&tab;/gi, "\t")
      .replace(/&newline;/gi, "\n")
      .replace(/&colon;/gi, ":")
      .replace(/&#x([0-9a-f]+);?/gi, (_full, hex: string) => {
        const n = Number.parseInt(hex, 16)
        if (!Number.isFinite(n) || n < 1 || n > 0x10ffff) return ""
        try {
          return String.fromCodePoint(n)
        } catch {
          return ""
        }
      })
      .replace(/&#(\d+);?/g, (_full, dec: string) => {
        const n = Number.parseInt(dec, 10)
        if (!Number.isFinite(n) || n < 1 || n > 0x10ffff) return ""
        try {
          return String.fromCodePoint(n)
        } catch {
          return ""
        }
      })
    if (next === s) break
    s = next
  }
  return s
}

export function sanitizeHostedSiteCss(css: string): string {
  return decodeHostedMarkup(css)
    .replace(/<\/style/gi, "")
    .replace(/@import\b/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/java\s*script\s*:/gi, "")
    .replace(/-moz-binding/gi, "")
    .slice(0, 20_000)
}

export function sanitizeHostedSiteHtml(html: string): string {
  return decodeHostedMarkup(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?script\b[^>]*>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<(object|embed|applet|link|meta|base|form|textarea|input|button|select|svg|math)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(object|embed|applet|link|meta|base|form|textarea|input|button|select|svg|math)[^>]*\/?>/gi, "")
    .replace(/([<\s/])on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "$1")
    .replace(/\s(href|src|xlink:href|action|formaction|poster)\s*=\s*(['"])\s*(javascript:|vbscript:|data:text)[^'"]*\2/gi, "")
    .replace(/\ssrcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/java\s*script\s*:/gi, "")
    .replace(/vb\s*script\s*:/gi, "")
    .replace(/data:\s*text\/html/gi, "")
    .slice(0, 50_000)
}

export function applyHostedSiteTokens(html: string, brand: HostedSiteBrand): string {
  const name = escapeHtml(brand.companyName.trim() || "Your company")
  const tagline = escapeHtml(brand.tagline.trim() || "Run this pipeline")
  const logo = isSafeLogoUrl(brand.logoUrl)
    ? `<img class="hs-logo" src="${escapeHtml(brand.logoUrl.trim())}" alt="${name}" />`
    : ""
  const email = escapeHtml("you@company.com")
  return html
    .replaceAll("{{company}}", name)
    .replaceAll("{{tagline}}", tagline)
    .replaceAll("{{logo}}", logo)
    .replaceAll("{{email}}", email)
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

function compileHostedSiteMarkup(
  sourceHtml: string,
  extraCss: string,
  brand: HostedSiteBrand,
  slot: string,
): HostedSiteHtmlParts {
  const unwrapped = unwrapVibeCodedHtml(sourceHtml)
  const html = applyHostedSiteTokens(sanitizeHostedSiteHtml(unwrapped.html), brand)
  const splitAt = html.indexOf(slot)
  const before = splitAt < 0 ? html : html.slice(0, splitAt)
  const after = splitAt < 0 ? "" : html.slice(splitAt + slot.length)
  const css = `${defaultHostedSiteCss()}\n${sanitizeHostedSiteCss(unwrapped.cssFromHtml)}\n${sanitizeHostedSiteCss(extraCss)}`
  return { before, after, css }
}

export function compileHostedSiteHtml(options: HostedSiteOptions): HostedSiteHtmlParts {
  return compileHostedSiteMarkup(
    options.customHtml.trim() || DEFAULT_HOSTED_SITE_HTML,
    options.customCss,
    options.brand,
    HOSTED_SITE_RUN_SLOT,
  )
}

export function compileHostedSiteAuthHtml(options: HostedSiteOptions): HostedSiteHtmlParts {
  return compileHostedSiteMarkup(
    options.authHtml.trim() || DEFAULT_HOSTED_SITE_AUTH_HTML,
    options.customCss,
    options.brand,
    HOSTED_SITE_AUTH_SLOT,
  )
}

export function hostedSiteSourceHtml(options: HostedSiteOptions, surface: hosted_site_surface): string {
  return surface === "signin"
    ? options.authHtml.trim() || DEFAULT_HOSTED_SITE_AUTH_HTML
    : options.customHtml.trim() || DEFAULT_HOSTED_SITE_HTML
}

function collectHostedSiteLookIssues(
  options: HostedSiteOptions,
  surface: hosted_site_surface,
  parts: HostedSiteHtmlParts,
): { issues: HostedSiteLookIssue[]; pageHtml: string } {
  const issues: HostedSiteLookIssue[] = []
  const slot = surface === "signin" ? HOSTED_SITE_AUTH_SLOT : HOSTED_SITE_RUN_SLOT
  const slotClass = surface === "signin" ? "hs-auth-slot" : "hs-run-slot"
  const company = escapeHtml(options.brand.companyName.trim() || "Your company")
  const vars = hostedSiteBrandVars(options.brand)
  const styleAttr = Object.entries(vars)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ")
  const pageHtml = `<div class="hs-root" style="${styleAttr}"><style>${parts.css}</style>${parts.before}<div class="${slotClass}"></div>${parts.after}${options.hideSpineFooter ? "" : `<p class="hs-foot">${company}</p>`}</div>`
  const markup = `${parts.before}${parts.after}`
  const unwrapped = unwrapVibeCodedHtml(hostedSiteSourceHtml(options, surface))
  const slotCount = sanitizeHostedSiteHtml(unwrapped.html).split(slot).length - 1
  const prefix = surface === "signin" ? "sign-in: " : ""

  if (!markup.trim()) {
    issues.push({ level: "error", code: "empty-html", message: `${prefix}compiled HTML is empty` })
  }
  if (/<!doctype|<html\b|<head\b|<body\b/i.test(markup)) {
    issues.push({ level: "error", code: "document-chrome", message: `${prefix}full document tags leaked into the hosted page` })
  }
  if (/<script\b|javascript:/i.test(pageHtml)) {
    issues.push({ level: "error", code: "script", message: `${prefix}script or javascript: survived compile` })
  }
  if (parts.before.includes(slot) || parts.after.includes(slot)) {
    issues.push({ level: "error", code: "run-slot-leftover", message: `${prefix}${slot} leftover after split` })
  }
  if (slotCount === 0) {
    issues.push({
      level: "warn",
      code: surface === "signin" ? "auth-slot-missing" : "run-slot-missing",
      message: `${prefix}no ${slot} slot; form is appended`,
    })
  } else if (slotCount > 1) {
    issues.push({
      level: "error",
      code: surface === "signin" ? "auth-slot-duplicate" : "run-slot-duplicate",
      message: `${prefix}multiple ${slot} slots`,
    })
  }
  const leftoverTokens = markup.match(/\{\{[a-z]+\}\}/gi) ?? []
  if (leftoverTokens.length) {
    issues.push({ level: "error", code: "token-leftover", message: `${prefix}unreplaced tokens: ${leftoverTokens.join(", ")}` })
  }
  if (!pageHtml.includes(slotClass) || !parts.css.includes(".hs-root") || !parts.css.includes(`.${slotClass}`)) {
    issues.push({ level: "error", code: "chrome-missing", message: `${prefix}hosted chrome CSS or slot missing` })
  }
  if (!pageHtml.includes("--hs-bg") || !pageHtml.includes(options.brand.backgroundColor)) {
    issues.push({ level: "error", code: "brand-vars", message: `${prefix}brand CSS variables missing` })
  }
  if (options.brand.companyName.trim() && !pageHtml.includes(company)) {
    issues.push({ level: "warn", code: "company-missing", message: `${prefix}company name not visible in compiled HTML` })
  }
  const cssOpens = (parts.css.match(/{/g) ?? []).length
  const cssCloses = (parts.css.match(/}/g) ?? []).length
  if (cssOpens !== cssCloses) {
    issues.push({ level: "error", code: "css-braces", message: `${prefix}CSS braces unbalanced (${cssOpens} vs ${cssCloses})` })
  }
  for (const tag of LOOK_CONTAINER_TAGS) {
    const open = (markup.match(new RegExp(`<${tag}\\b`, "gi")) ?? []).length
    const close = (markup.match(new RegExp(`</${tag}>`, "gi")) ?? []).length
    if (open !== close) {
      issues.push({ level: "warn", code: "tag-balance", message: `${prefix}<${tag}> open ${open} close ${close}` })
    }
  }
  if (!/<h[1-3]\b|hs-title/i.test(markup)) {
    issues.push({ level: "warn", code: "no-heading", message: `${prefix}no heading in compiled HTML` })
  }
  return { issues, pageHtml }
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
  const app = collectHostedSiteLookIssues(options, "app", parts)
  issues.push(...app.issues)

  if (options.auth.enabled) {
    let authParts: HostedSiteHtmlParts
    try {
      authParts = compileHostedSiteAuthHtml(options)
    } catch (err) {
      authParts = { before: "", after: "", css: "" }
      issues.push({
        level: "error",
        code: "compile-throw",
        message: err instanceof Error ? `sign-in: ${err.message}` : `sign-in: ${String(err)}`,
      })
    }
    issues.push(...collectHostedSiteLookIssues(options, "signin", authParts).issues)
  }

  return { ok: issues.every((issue) => issue.level !== "error"), parts, pageHtml: app.pageHtml, issues }
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

function normalizeHostedSiteAuth(raw: unknown): HostedSiteAuth {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<HostedSiteAuth>
  const provider: HostedSiteAuthProvider = o.provider === "custom_supabase" ? "custom_supabase" : "spine"
  return {
    enabled: o.enabled === true,
    provider,
    customSupabaseUrl: typeof o.customSupabaseUrl === "string" ? o.customSupabaseUrl.trim().slice(0, 2048) : "",
    customSupabaseAnonKey: typeof o.customSupabaseAnonKey === "string" ? o.customSupabaseAnonKey.trim().slice(0, 2048) : "",
  }
}

export function normalizeHostedSiteOptions(raw: unknown): HostedSiteOptions {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<HostedSiteOptions>
  return {
    brand: normalizeHostedSiteBrand(o.brand),
    customHtml: typeof o.customHtml === "string" ? o.customHtml.slice(0, 50_000) : "",
    customCss: typeof o.customCss === "string" ? o.customCss.slice(0, 20_000) : "",
    hideSpineFooter: o.hideSpineFooter === true,
    auth: normalizeHostedSiteAuth(o.auth ?? DEFAULT_HOSTED_SITE_AUTH),
    authHtml: typeof o.authHtml === "string" ? o.authHtml.slice(0, 50_000) : "",
  }
}

// AI : vibe response is a full snapshot of what was sent — keep fields the user edited while the LLM ran.
export function keepConcurrentHostedSiteEdits(
  sent: HostedSiteOptions,
  received: HostedSiteOptions,
  latest: HostedSiteOptions,
): HostedSiteOptions {
  const keep = <T>(fromReceived: T, fromSent: T, fromLatest: T): T =>
    fromReceived !== fromSent ? fromReceived : fromLatest
  const pick = <T extends object>(fromReceived: T, fromSent: T, fromLatest: T): T => {
    const next = { ...fromLatest }
    for (const key of Object.keys(fromSent) as (keyof T)[]) {
      next[key] = keep(fromReceived[key], fromSent[key], fromLatest[key])
    }
    return next
  }
  return {
    brand: pick(received.brand, sent.brand, latest.brand),
    customHtml: keep(received.customHtml, sent.customHtml, latest.customHtml),
    customCss: keep(received.customCss, sent.customCss, latest.customCss),
    hideSpineFooter: keep(received.hideSpineFooter, sent.hideSpineFooter, latest.hideSpineFooter),
    auth: pick(received.auth, sent.auth, latest.auth),
    authHtml: keep(received.authHtml, sent.authHtml, latest.authHtml),
  }
}
