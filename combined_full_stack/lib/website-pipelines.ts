import { DEFAULT_HOSTED_SITE_HTML, DEFAULT_HOSTED_SITE_LANDING_HTML } from "@/lib/hosted-site-defaults"
import { isUnnamedProjectName } from "@/lib/project-assistant-types"
import type { Project, ProjectId } from "@/lib/types"
import type {
  HostedSiteOptions,
  SharedLinkRecord,
  website_pipeline_alias,
  WebsitePipelineBinding,
} from "@/lib/shared-link-types"

export const UNNAMED_WEBSITE_NAME = "Untitled Website" as const

export function nullableProjectId(raw: unknown): ProjectId | null {
  return typeof raw === "string" && raw.trim() ? (raw as ProjectId) : null
}

// AI : page-only sites persist a stub snapshot so snapshot jsonb stays required.
export function pageOnlyProjectStub(name: string = UNNAMED_WEBSITE_NAME): Project {
  return {
    id: "" as ProjectId,
    name,
    kind: "page",
    models: [],
    modules: [],
    strategies: [],
  }
}

export function remapWebsiteProjectId(
  options: HostedSiteOptions,
  fromId: ProjectId | null,
  toId: ProjectId | null,
): HostedSiteOptions {
  if (!fromId || !toId || fromId === toId) return options
  return {
    ...options,
    pipelineBindings: options.pipelineBindings.map((b) =>
      b.projectId === fromId ? { ...b, projectId: toId } : b,
    ),
  }
}

export type pipeline_website_delete_action = "delete" | "unbind"

export type website_dependent = {
  id: SharedLinkRecord["id"]
  name: string
}

export function websiteUsesProject(
  site: Pick<SharedLinkRecord, "projectId" | "siteOptions">,
  projectId: ProjectId,
): boolean {
  if (site.projectId === projectId) return true
  return listedWebsitePipelineBindings(site.siteOptions.pipelineBindings).some((b) => b.projectId === projectId)
}

export function websitesUsingProject(
  sites: Pick<SharedLinkRecord, "id" | "name" | "projectId" | "siteOptions">[],
  projectId: ProjectId,
): website_dependent[] {
  return sites
    .filter((site) => websiteUsesProject(site, projectId))
    .map((site) => ({ id: site.id, name: websiteDisplayName(site) }))
}

export function unbindProjectFromWebsite(options: HostedSiteOptions, projectId: ProjectId): HostedSiteOptions {
  const listed = listedWebsitePipelineBindings(options.pipelineBindings)
  const removed = listed.filter((b) => b.projectId === projectId)
  if (removed.length === 0) return options
  let next = options
  for (const binding of removed) {
    next = stripWebsitePipelineFromCode(next, binding.alias)
  }
  return {
    ...next,
    pipelineBindings: listed.filter((b) => b.projectId !== projectId),
  }
}

export function nextPrimaryProjectIdAfterUnbind(
  current: ProjectId | null,
  unboundOptions: HostedSiteOptions,
  removedId: ProjectId,
): ProjectId | null {
  if (current && current !== removedId) return current
  return listedWebsitePipelineBindings(unboundOptions.pipelineBindings)[0]?.projectId ?? null
}

// AI : websites are not pipelines — never inherit "Untitled Pipeline" as the page title.
export function websiteNameForCreate(suggested: string): string {
  const trimmed = suggested.trim()
  if (!trimmed || isUnnamedProjectName(trimmed)) return UNNAMED_WEBSITE_NAME
  return trimmed
}

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
    const rec = row as { alias?: unknown; projectId?: unknown; functionId?: unknown }
    const projectId = typeof rec.projectId === "string" && rec.projectId.trim() ? (rec.projectId as ProjectId) : null
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
    const functionId = typeof rec.functionId === "string" && rec.functionId.trim() ? rec.functionId.trim() : undefined
    out.push({
      alias: alias as website_pipeline_alias,
      projectId,
      ...(functionId ? { functionId: functionId as WebsitePipelineBinding["functionId"] } : {}),
    })
  }
  return out
}

export function resolveWebsitePipelineBindings(
  _primaryProjectId: ProjectId | "" | null | undefined,
  bindings: WebsitePipelineBinding[],
): WebsitePipelineBinding[] {
  // AI : empty stays empty — a page-only site has no host pipeline (#18).
  return listedWebsitePipelineBindings(bindings)
}

export function websiteHasRunnableBackend(bindings: WebsitePipelineBinding[]): boolean {
  return listedWebsitePipelineBindings(bindings).length > 0
}

// AI : stored attachments only — empty means a Lovable-style page with no pipeline backend.
export function listedWebsitePipelineBindings(bindings: WebsitePipelineBinding[]): WebsitePipelineBinding[] {
  return normalizeWebsitePipelineBindings(bindings)
}

export function websiteBoundProjectIds(
  _primaryProjectId: ProjectId | null | "",
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
      companyName: websiteNameForCreate(name),
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
  // AI : "{{run}}" is a prefix of "{{run:alias}}" — never split/replaceAll the bare token as a substring.
  if (alias === DEFAULT_WEBSITE_PIPELINE_ALIAS) return html.replace(/\{\{run\}\}/g, "")
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
