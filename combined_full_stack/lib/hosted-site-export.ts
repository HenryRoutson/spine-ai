import {
  compileHostedSiteAuthHtml,
  compileHostedSiteHtml,
  compileHostedSitePageHtml,
  DEFAULT_HOSTED_SITE_AUTH_HTML,
  DEFAULT_HOSTED_SITE_HTML,
  hostedSiteBrandVars,
  normalizeHostedSiteOptions,
  type HostedSiteHtmlParts,
  type hosted_site_surface,
} from "@/lib/hosted-site"
import { HOSTED_SITE_SLOT_CLASS, hostedSiteHasPrimarySlot, type hosted_site_widget_slot } from "@/lib/hosted-site-slots"
import type { HostedSiteOptions } from "@/lib/shared-link-types"
import { escapeHtml } from "@/lib/standalone-html"
import { generateUploadFormHtml, injectHtmlIntoHostedSlot } from "@/lib/hosted-site-upload-ui"
import { generateStepProgressHtml } from "@/lib/hosted-site-progress"
import type { Project } from "@/lib/types"

export type HostedSiteExportFile = {
  filename: string
  content: string
  mime: string
}

export const HOSTED_APP_ENV_PLACEHOLDERS = [
  "# Hosted vibe-coded app — leave empty until you wire auth / a separate Supabase",
  'NEXT_PUBLIC_SUPABASE_URL=""',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""',
  'CUSTOM_SUPABASE_URL=""',
  'CUSTOM_SUPABASE_ANON_KEY=""',
].join("\n")

export function hostedSiteOptionsForExport(project: Project, siteOptions?: unknown): HostedSiteOptions {
  const base = normalizeHostedSiteOptions(siteOptions)
  return {
    ...base,
    brand: {
      ...base.brand,
      companyName: base.brand.companyName.trim() || project.name,
      tagline: base.brand.tagline.trim() || "Workspace",
    },
    customHtml: base.customHtml.trim() || DEFAULT_HOSTED_SITE_HTML,
    authHtml: base.authHtml.trim() || DEFAULT_HOSTED_SITE_AUTH_HTML,
  }
}

function slotExportComment(slot: hosted_site_widget_slot): string {
  if (slot === "auth") return "<!-- auth form mounts here when you wire sign-in later -->"
  if (slot === "run") return "<!-- pipeline run form / auto-generated upload UI mounts here -->"
  if (slot === "output") return "<!-- DataViewPanel / run output mounts here -->"
  if (slot === "chatbot") return "<!-- ChatbotPanel mounts here -->"
  if (slot === "sql") return "<!-- live SQL rows from the hosted app store mount here -->"
  if (slot === "action") return "<!-- pipeline action button mounts here -->"
  if (slot === "pay") return "<!-- checkout / pay widget mounts here -->"
  if (slot === "table") return "<!-- live structure table mounts here -->"
  if (slot === "docs") return "<!-- visitor file upload — pipelines quote from these documents -->"
  return "<!-- viewer markdown mounts here -->"
}

function hostedSiteBodyFromParts(parts: HostedSiteHtmlParts, primary: hosted_site_widget_slot): string {
  const hasPrimary = hostedSiteHasPrimarySlot(parts.segments, primary === "auth" ? "signin" : "app")
  const body = parts.segments
    .map((s) => {
      if (s.kind === "html") return s.html
      return `${slotExportComment(s.slot)}\n    <div class="${HOSTED_SITE_SLOT_CLASS[s.slot]}"></div>`
    })
    .join("\n    ")
  if (hasPrimary) return body
  return `${body}\n    ${slotExportComment(primary)}\n    <div class="${HOSTED_SITE_SLOT_CLASS[primary]}"></div>`
}

function hostedSiteStandaloneFromParts(
  options: HostedSiteOptions,
  parts: HostedSiteHtmlParts,
  primary: hosted_site_widget_slot,
): string {
  const vars = hostedSiteBrandVars(options.brand)
  const styleAttr = Object.entries(vars)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ")
  const company = escapeHtml(options.brand.companyName.trim() || "Your company")
  const footer = options.hideSpineFooter ? "" : `<p class="hs-foot">${company}</p>`
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${company}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="hs-root" style="${styleAttr}">
    ${hostedSiteBodyFromParts(parts, primary)}
    ${footer}
  </div>
</body>
</html>
`
}

function hostedSiteStandaloneHtml(options: HostedSiteOptions, surface: hosted_site_surface): string {
  const parts = surface === "signin" ? compileHostedSiteAuthHtml(options) : compileHostedSiteHtml(options)
  return hostedSiteStandaloneFromParts(options, parts, surface === "signin" ? "auth" : "run")
}

export function generateHostedSiteExportFiles(project: Project, siteOptions?: unknown): HostedSiteExportFile[] {
  const options = hostedSiteOptionsForExport(project, siteOptions)
  const app = compileHostedSiteHtml(options)
  const extraPages = options.pages.map((page) => {
    const parts = compileHostedSitePageHtml(options, page.html)
    return {
      filename: `hosted/${page.path}.html`,
      content: injectRunSlotWidgets(
        hostedSiteStandaloneFromParts(options, parts, "run"),
        project.modules,
      ),
      mime: "text/html",
    }
  })
  return [
    {
      filename: "hosted/index.html",
      content: injectRunSlotWidgets(hostedSiteStandaloneHtml(options, "app"), project.modules),
      mime: "text/html",
    },
    ...extraPages,
    { filename: "hosted/auth.html", content: hostedSiteStandaloneHtml(options, "signin"), mime: "text/html" },
    { filename: "hosted/styles.css", content: `${app.css.trim()}\n`, mime: "text/css" },
    { filename: "hosted/.env.example", content: `${HOSTED_APP_ENV_PLACEHOLDERS}\n`, mime: "text/plain" },
  ]
}

function injectRunSlotWidgets(html: string, modules: Project["modules"]): string {
  // AI : {{docs}} owns the upload form so export HTML can quote visitor files; {{run}} keeps progress.
  const progress = generateStepProgressHtml(modules)
  const form = generateUploadFormHtml(modules)
  const docsClass = HOSTED_SITE_SLOT_CLASS.docs
  const runClass = HOSTED_SITE_SLOT_CLASS.run
  if (html.includes(`class="${docsClass}"`)) {
    let out = injectHtmlIntoHostedSlot(html, docsClass, form)
    if (out.includes(`class="${runClass}"`)) {
      out = injectHtmlIntoHostedSlot(out, runClass, progress)
    }
    return out
  }
  const inner = [progress, form].filter(Boolean).join("\n")
  return injectHtmlIntoHostedSlot(html, runClass, inner)
}
