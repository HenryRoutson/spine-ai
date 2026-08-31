// AI : a hosted page with SQL / auth / actions gets its own Supabase — not Spine prod schema.
import { ModuleKind, type Project } from "@/lib/types"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { storedFunctionsOnProject } from "@/lib/pipeline-functions"
import { parseSupabaseAnonKey, parseSupabaseProjectUrl } from "@/lib/supabase-site-provision"
import type { HostedSiteAuth, HostedSiteOptions } from "@/lib/shared-link-types"

const BACKEND_SLOT_RE = /\{\{(?:sql|action|table)(?::[^}]*)?\}\}/i

export function hostedHtmlHasBackendSlots(html: string): boolean {
  return BACKEND_SLOT_RE.test(html)
}

export function projectHasSqlOrUserTables(
  project: Pick<Project, "models" | "modules" | "functions">,
): boolean {
  if (project.models.some((m) => !m.auto)) return true
  return storedFunctionsOnProject(project as Project).some((fn) =>
    flattenPipelineModules(fn.modules).some((m) => m.kind === ModuleKind.Sql),
  )
}

export function websiteNeedsIsolatedSupabase(
  site: HostedSiteOptions,
  project?: Pick<Project, "models" | "modules" | "functions"> | null,
): boolean {
  if (site.auth.enabled) return true
  if (site.actions.length > 0) return true
  if (hostedHtmlHasBackendSlots(site.customHtml) || hostedHtmlHasBackendSlots(site.authHtml)) return true
  if (site.pages.some((page) => hostedHtmlHasBackendSlots(page.html))) return true
  if (project && projectHasSqlOrUserTables(project)) return true
  return false
}

export function websiteHasByoSupabase(auth: HostedSiteAuth): boolean {
  return (
    auth.provider === "custom_supabase" &&
    !auth.projectRef &&
    Boolean(parseSupabaseProjectUrl(auth.customSupabaseUrl) && parseSupabaseAnonKey(auth.customSupabaseAnonKey))
  )
}

export function isolatedSiteAuthReady(auth: HostedSiteAuth): boolean {
  return (
    auth.allocStatus === "ready" &&
    Boolean(parseSupabaseProjectUrl(auth.customSupabaseUrl) && parseSupabaseAnonKey(auth.customSupabaseAnonKey))
  )
}

// AI : PATCH HTML must not wipe a project we already created.
export function mergePreservedSiteAlloc(prev: HostedSiteAuth, next: HostedSiteAuth): HostedSiteAuth {
  if (!prev.projectRef && prev.allocStatus !== "pending" && prev.allocStatus !== "ready") return next
  return {
    ...next,
    projectRef: prev.projectRef,
    allocStatus: prev.allocStatus,
    allocError: prev.allocError,
    customSupabaseUrl: prev.allocStatus === "ready" ? prev.customSupabaseUrl : next.customSupabaseUrl,
    customSupabaseAnonKey: prev.allocStatus === "ready" ? prev.customSupabaseAnonKey : next.customSupabaseAnonKey,
  }
}

export function markPendingIsolatedAlloc(
  site: HostedSiteOptions,
  project?: Pick<Project, "models" | "modules" | "functions"> | null,
): HostedSiteOptions {
  if (site.auth.projectRef || site.auth.allocStatus === "ready" || site.auth.allocStatus === "pending") return site
  if (websiteHasByoSupabase(site.auth)) return site
  if (!websiteNeedsIsolatedSupabase(site, project)) return site
  return { ...site, auth: { ...site.auth, allocStatus: "pending", allocError: "" } }
}
