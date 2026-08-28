import { DEFAULT_HOSTED_SITE_HTML, DEFAULT_HOSTED_SITE_LANDING_HTML } from "@/lib/hosted-site-defaults"
import type { Project, ProjectId } from "@/lib/types"
import type {
  HostedSiteOptions,
  SharedLinkRecord,
  website_pipeline_alias,
  WebsitePipelineBinding,
} from "@/lib/shared-link-types"

export function websiteDisplayName(site: Pick<SharedLinkRecord, "name" | "siteOptions">): string {
  return site.siteOptions.brand.companyName.trim() || site.name
}

export const DEFAULT_WEBSITE_PIPELINE_ALIAS = "run" as website_pipeline_alias

// AI : TODO (spine-in-spine-bootstrap-S5-user-run) — reserved alias "active-user-project" resolves to
// AI :   session.snapshot.activeProjectId (host engine), not a binding on the meta Spine-in-Spine project.

const ALIAS_RE = /^[a-z][a-z0-9_-]{0,39}$/

export function isWebsitePipelineAlias(raw: string): raw is website_pipeline_alias {
  return ALIAS_RE.test(raw)
}

export function websitePipelineAliasFromName(name: string): website_pipeline_alias {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  if (isWebsitePipelineAlias(slug) && slug !== DEFAULT_WEBSITE_PIPELINE_ALIAS) return slug
  return "pipeline" as website_pipeline_alias
}

export function normalizeWebsitePipelineBindings(raw: unknown): WebsitePipelineBinding[] {
  if (!Array.isArray(raw)) return []
  const usedAliases = new Set<string>()
  const usedProjects = new Set<string>()
  const out: WebsitePipelineBinding[] = []
  for (const row of raw.slice(0, 24)) {
    if (!row || typeof row !== "object") continue
    const rec = row as { alias?: unknown; projectId?: unknown }
    const projectId = typeof rec.projectId === "string" ? (rec.projectId as ProjectId) : null
    if (!projectId || usedProjects.has(projectId)) continue
    let alias = typeof rec.alias === "string" ? rec.alias.trim().toLowerCase() : ""
    if (!isWebsitePipelineAlias(alias) || usedAliases.has(alias)) {
      alias = usedAliases.has(DEFAULT_WEBSITE_PIPELINE_ALIAS)
        ? websitePipelineAliasFromName(projectId)
        : DEFAULT_WEBSITE_PIPELINE_ALIAS
      if (usedAliases.has(alias)) continue
    }
    usedAliases.add(alias)
    usedProjects.add(projectId)
    out.push({ alias: alias as website_pipeline_alias, projectId })
  }
  return out
}

export function resolveWebsitePipelineBindings(
  primaryProjectId: ProjectId,
  bindings: WebsitePipelineBinding[],
): WebsitePipelineBinding[] {
  const listed = listedWebsitePipelineBindings(bindings)
  if (listed.length === 0) {
    return [{ alias: DEFAULT_WEBSITE_PIPELINE_ALIAS, projectId: primaryProjectId }]
  }
  if (listed.some((b) => b.projectId === primaryProjectId)) return listed
  return [
    { alias: DEFAULT_WEBSITE_PIPELINE_ALIAS, projectId: primaryProjectId },
    ...listed.filter((b) => b.alias !== DEFAULT_WEBSITE_PIPELINE_ALIAS),
  ]
}

// AI : stored attachments only — empty means a Lovable-style page with no pipeline backend.
export function listedWebsitePipelineBindings(bindings: WebsitePipelineBinding[]): WebsitePipelineBinding[] {
  return normalizeWebsitePipelineBindings(bindings)
}

export function websiteBoundProjectIds(
  _primaryProjectId: ProjectId,
  bindings: WebsitePipelineBinding[],
): ProjectId[] {
  return [...new Set(listedWebsitePipelineBindings(bindings).map((b) => b.projectId))]
}

export function bindingsFromProjectIds(
  projectIds: ProjectId[],
  projects: Pick<Project, "id" | "name">[],
): WebsitePipelineBinding[] {
  const unique = [...new Set(projectIds)]
  return unique.map((projectId, i) => {
    const name = projects.find((p) => p.id === projectId)?.name ?? projectId
    return {
      alias: i === 0 ? DEFAULT_WEBSITE_PIPELINE_ALIAS : websitePipelineAliasFromName(name),
      projectId,
    }
  })
}

// AI : picker / Share mint — empty pipeline list is a Lovable page (no {{run}}), not an implicit host pipeline.
export function hostedSiteOptionsForCreate({
  name,
  pipelineIds,
  projects,
}: {
  name: string
  pipelineIds: ProjectId[]
  projects: Pick<Project, "id" | "name">[]
}): {
  brand: { companyName: string; tagline: string }
  customHtml: string
  pipelineBindings: WebsitePipelineBinding[]
} {
  const hasPipelines = pipelineIds.length > 0
  return {
    brand: {
      companyName: name,
      tagline: hasPipelines ? "Run attached pipelines" : "Your product",
    },
    customHtml: hasPipelines ? DEFAULT_HOSTED_SITE_HTML : DEFAULT_HOSTED_SITE_LANDING_HTML,
    pipelineBindings: hasPipelines ? bindingsFromProjectIds(pipelineIds, projects) : [],
  }
}

function htmlRunToken(alias: string): string {
  return alias === DEFAULT_WEBSITE_PIPELINE_ALIAS ? "{{run}}" : `{{run:${alias}}}`
}

function stripHtmlRunToken(html: string, alias: string): string {
  return html.split(htmlRunToken(alias)).join("")
}

function insertHtmlRunToken(html: string, alias: string): string {
  const token = htmlRunToken(alias)
  if (html.includes(token)) return html
  return html.trim() ? `${html.trimEnd()}\n${token}\n` : token
}

function stripReactRunWidget(source: string, alias: string): string {
  const quoted = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return source
    .replace(new RegExp(`<RunPipeline\\s+alias=["']${quoted}["']\\s*/>\\n?`, "g"), "")
    .replace(new RegExp(`\\{\\s*kind:\\s*"run"\\s*,\\s*alias:\\s*"${quoted}"\\s*\\},?\\n?`, "g"), "")
}

function insertReactRunWidget(source: string, alias: string): string {
  if (source.includes(`alias="${alias}"`) || source.includes(`alias='${alias}'`) || source.includes(`alias: "${alias}"`)) {
    return source
  }
  const row = `  { kind: "run", alias: ${JSON.stringify(alias)} },\n`
  if (source.includes("] as const")) return source.replace("] as const", `${row}] as const`)
  return source.replace(
    /(<RunPipeline\s+alias=["'][^"']+["']\s*\/>)/,
    `$1\n      <RunPipeline alias=${JSON.stringify(alias)} />`,
  )
}

export function stripWebsitePipelineFromCode(
  options: HostedSiteOptions,
  alias: string,
): HostedSiteOptions {
  return {
    ...options,
    customHtml: stripHtmlRunToken(options.customHtml, alias),
    pages: options.pages.map((page) => ({ ...page, html: stripHtmlRunToken(page.html, alias) })),
    reactFiles: options.reactFiles.map((file) => ({
      ...file,
      contents: stripReactRunWidget(file.contents, alias),
    })),
  }
}

export function insertWebsitePipelineInCode(
  options: HostedSiteOptions,
  alias: string,
): HostedSiteOptions {
  return {
    ...options,
    customHtml: insertHtmlRunToken(options.customHtml, alias),
    reactFiles: options.reactFiles.map((file) =>
      file.path === "src/App.tsx" ? { ...file, contents: insertReactRunWidget(file.contents, alias) } : file,
    ),
  }
}
