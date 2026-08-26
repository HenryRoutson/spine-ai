import {
  compileHostedSiteAuthHtml,
  compileHostedSiteHtml,
  DEFAULT_HOSTED_SITE_AUTH_HTML,
  DEFAULT_HOSTED_SITE_HTML,
  hostedSiteBrandVars,
  normalizeHostedSiteOptions,
  type hosted_site_surface,
} from "@/lib/hosted-site"
import type { HostedSiteOptions } from "@/lib/shared-link-types"
import { escapeHtml } from "@/lib/standalone-html"
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

function hostedSiteStandaloneHtml(options: HostedSiteOptions, surface: hosted_site_surface): string {
  const parts = surface === "signin" ? compileHostedSiteAuthHtml(options) : compileHostedSiteHtml(options)
  const vars = hostedSiteBrandVars(options.brand)
  const styleAttr = Object.entries(vars)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ")
  const company = escapeHtml(options.brand.companyName.trim() || "Your company")
  const slotClass = surface === "signin" ? "hs-auth-slot" : "hs-run-slot"
  const slotComment =
    surface === "signin"
      ? "<!-- auth form mounts here when you wire sign-in later -->"
      : "<!-- pipeline run form / inference_ui.html mounts here -->"
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
    ${parts.before}
    ${slotComment}
    <div class="${slotClass}"></div>
    ${parts.after}
    ${footer}
  </div>
</body>
</html>
`
}

export function generateHostedSiteExportFiles(project: Project, siteOptions?: unknown): HostedSiteExportFile[] {
  const options = hostedSiteOptionsForExport(project, siteOptions)
  const app = compileHostedSiteHtml(options)
  return [
    { filename: "hosted/index.html", content: hostedSiteStandaloneHtml(options, "app"), mime: "text/html" },
    { filename: "hosted/auth.html", content: hostedSiteStandaloneHtml(options, "signin"), mime: "text/html" },
    { filename: "hosted/styles.css", content: `${app.css.trim()}\n`, mime: "text/css" },
    { filename: "hosted/.env.example", content: `${HOSTED_APP_ENV_PLACEHOLDERS}\n`, mime: "text/plain" },
  ]
}
