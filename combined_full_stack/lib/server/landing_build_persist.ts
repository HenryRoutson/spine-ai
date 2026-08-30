// AI : shared landing-build payload — disk (/tmp) is per-instance on Vercel; Supabase is the cross-lambda store.

import { createAdminClient } from "@/lib/server/supabase_admin"
import { logger } from "@/lib/server/server_logger"
import { migrateProjectModules } from "@/lib/server/validity"
import type { DocId, DocRef, Project, ProjectId } from "@/lib/server/types"

const persistLog = logger("landing-build-persist")

export const LANDING_BUILD_ID_RE = /^p_land_[a-z0-9]+$/i
export const LANDING_BUILD_REMOTE_SCAN = 40
export const LANDING_BUILD_DIAGNOSTIC_KEY = "landingBuild"

export type LandingBuildDoc = { ref: DocRef; content: string }
export type LandingBuildBundle = { project: Project; docs: LandingBuildDoc[] }

export function isValidLandingBuildId(id: string): boolean {
  return LANDING_BUILD_ID_RE.test(id)
}

export function parseLandingBuildPayload(raw: unknown): LandingBuildBundle | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as { project?: Project; docs?: LandingBuildDoc[] } & Partial<Project>
  if ("id" in obj && "modules" in obj && !("project" in obj)) {
    return { project: migrateProjectModules(obj as Project), docs: [] }
  }
  if (!obj.project) return null
  return {
    project: migrateProjectModules(obj.project),
    docs: (obj.docs ?? []).map((d) => ({ ref: d.ref, content: d.content })),
  }
}

export function landingBuildFromDiagnosticJson(raw: unknown): LandingBuildBundle | null {
  if (!raw || typeof raw !== "object") return null
  const wrap = (raw as Record<string, unknown>)[LANDING_BUILD_DIAGNOSTIC_KEY]
  return parseLandingBuildPayload(wrap ?? null)
}

export function landingBuildDiagnosticJson(bundle: LandingBuildBundle): Record<string, unknown> {
  return { [LANDING_BUILD_DIAGNOSTIC_KEY]: { project: bundle.project, docs: bundle.docs } }
}

export async function upsertLandingBuildRemote(
  id: ProjectId,
  bundle: LandingBuildBundle,
): Promise<void> {
  const admin = await createAdminClient()
  if (!admin) return
  const { error } = await admin.from("landing_page_builds").upsert(
    { id, project: bundle.project, docs: bundle.docs },
    { onConflict: "id" },
  )
  if (error) persistLog.warn("landing_page_builds upsert failed", { error: error.message, id })
}

async function fetchLandingBuildFromCalls(id: string): Promise<LandingBuildBundle | null> {
  const admin = await createAdminClient()
  if (!admin) return null
  const { data, error } = await admin
    .from("landing_page_calls")
    .select("diagnostic_json")
    .eq("build_id", id)
    .eq("tag", "build-pipeline")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    persistLog.warn("landing_page_calls build read failed", { error: error.message, id })
    return null
  }
  return landingBuildFromDiagnosticJson(data?.diagnostic_json)
}

export async function fetchLandingBuildRemote(id: string): Promise<LandingBuildBundle | null> {
  if (!isValidLandingBuildId(id)) return null
  const admin = await createAdminClient()
  if (!admin) return null
  const { data, error } = await admin
    .from("landing_page_builds")
    .select("project, docs")
    .eq("id", id)
    .maybeSingle()
  if (!error && data) {
    const parsed = parseLandingBuildPayload({ project: data.project, docs: data.docs })
    if (parsed) return parsed
  }
  if (error) persistLog.warn("landing_page_builds read failed", { error: error.message, id })
  // AI : prod already has landing_page_calls — works before landing_page_builds is migrated.
  return fetchLandingBuildFromCalls(id)
}

function docContentFromBundle(bundle: LandingBuildBundle, docId: DocId): string | undefined {
  return bundle.docs.find((d) => d.ref?.id === docId)?.content
}

export async function fetchLandingBuildDocRemote(docId: DocId): Promise<string | undefined> {
  const admin = await createAdminClient()
  if (!admin) return undefined
  const { data, error } = await admin
    .from("landing_page_builds")
    .select("docs")
    .order("created_at", { ascending: false })
    .limit(LANDING_BUILD_REMOTE_SCAN)
  if (!error) {
    for (const row of data ?? []) {
      const docs = row.docs as LandingBuildDoc[] | null
      const hit = docs?.find((d) => d.ref?.id === docId)
      if (hit) return hit.content
    }
  } else {
    persistLog.warn("landing_page_builds doc scan failed", { error: error.message })
  }
  const { data: calls, error: callErr } = await admin
    .from("landing_page_calls")
    .select("diagnostic_json")
    .eq("tag", "build-pipeline")
    .order("created_at", { ascending: false })
    .limit(LANDING_BUILD_REMOTE_SCAN)
  if (callErr) {
    persistLog.warn("landing_page_calls doc scan failed", { error: callErr.message })
    return undefined
  }
  for (const row of calls ?? []) {
    const bundle = landingBuildFromDiagnosticJson(row.diagnostic_json)
    const hit = bundle ? docContentFromBundle(bundle, docId) : undefined
    if (hit !== undefined) return hit
  }
  return undefined
}
