// AI : Supabase Management API — create a Cloud project per hosted website.

export type supabase_project_ref = string & { __brand: "supabase_project_ref" }
export type supabase_region_group = "americas" | "emea" | "apac"

export type MgmtConfig = {
  token: string
  orgSlug: string
  regionGroup: supabase_region_group
}

export type CreatedProject = {
  ref: supabase_project_ref
  name: string
}

export type ProjectApiKeys = {
  anonKey: string
  serviceRoleKey: string
}

export type HealthService = { name: string; status: string }

const MGMT_BASE = "https://api.supabase.com/v1"

export function readSupabaseMgmtConfig(
  env: NodeJS.ProcessEnv = process.env,
): { ok: true; config: MgmtConfig } | { ok: false; error: string } {
  const token = env.SUPABASE_ACCESS_TOKEN?.trim() ?? ""
  const orgSlug = env.SUPABASE_ORG_SLUG?.trim() ?? ""
  const regionRaw = (env.SUPABASE_REGION_GROUP?.trim() || "americas").toLowerCase()
  const regionGroup: supabase_region_group =
    regionRaw === "emea" || regionRaw === "apac" || regionRaw === "americas" ? regionRaw : "americas"
  if (!token || !orgSlug) {
    return {
      ok: false,
      error:
        "Set SUPABASE_ACCESS_TOKEN (personal access token with organization_projects_create) and SUPABASE_ORG_SLUG. Spine will not create tables on the platform database.",
    }
  }
  return { ok: true, config: { token, orgSlug, regionGroup } }
}

import { randomBytes } from "node:crypto"

export function generateSupabaseDbPassword(): string {
  return `Sp1!${randomBytes(18).toString("base64url")}`
}

export function projectNameForSite(siteId: string): string {
  const slug = siteId.replace(/[^a-zA-Z0-9-]/g, "-").replace(/^site-/i, "").slice(0, 18)
  return `spine-${slug}`.slice(0, 32)
}

type ApiKeyRow = {
  name?: string
  type?: string
  api_key?: string
  apiKey?: string
}

export function pickProjectApiKeys(rows: unknown): ProjectApiKeys | null {
  if (!Array.isArray(rows)) return null
  const keys = rows as ApiKeyRow[]
  const valueOf = (row: ApiKeyRow): string => (row.api_key ?? row.apiKey ?? "").trim()
  const named = (want: string[]) =>
    keys.find((row) => want.includes((row.type ?? "").toLowerCase()) || want.includes((row.name ?? "").toLowerCase()))
  const anon = named(["anon", "publishable"])
  const service = named(["service_role", "secret"])
  const anonKey = anon ? valueOf(anon) : ""
  const serviceRoleKey = service ? valueOf(service) : ""
  if (!anonKey || !serviceRoleKey) return null
  return { anonKey, serviceRoleKey }
}

export function projectRefFromCreateBody(body: unknown): supabase_project_ref | null {
  if (!body || typeof body !== "object") return null
  const o = body as { id?: unknown; ref?: string }
  const id = typeof o.id === "string" ? o.id.trim() : typeof o.ref === "string" ? o.ref.trim() : ""
  return id ? (id as supabase_project_ref) : null
}

export function servicesAreHealthy(rows: unknown, needed: string[] = ["auth", "db", "rest"]): boolean {
  if (!Array.isArray(rows)) return false
  const byName = new Map<string, string>()
  for (const row of rows as HealthService[]) {
    if (row && typeof row.name === "string") byName.set(row.name, String(row.status ?? ""))
  }
  return needed.every((name) => {
    const status = (byName.get(name) ?? "").toUpperCase()
    return status === "ACTIVE_HEALTHY" || status === "HEALTHY"
  })
}

export type MgmtClient = {
  createProject: (name: string, dbPass: string) => Promise<CreatedProject>
  listHealth: (ref: supabase_project_ref) => Promise<HealthService[]>
  getApiKeys: (ref: supabase_project_ref) => Promise<ProjectApiKeys>
  execSql: (ref: supabase_project_ref, sql: string) => Promise<void>
}

export function createSupabaseMgmt(
  config: MgmtConfig,
  fetchImpl: typeof fetch = fetch,
): MgmtClient {
  async function mgmt<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetchImpl(`${MGMT_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    })
    const text = await res.text()
    let json: unknown = null
    if (text) {
      try {
        json = JSON.parse(text) as unknown
      } catch {
        json = { message: text }
      }
    }
    if (!res.ok) {
      const msg =
        json && typeof json === "object" && "message" in json
          ? String((json as { message: unknown }).message)
          : `Management API ${res.status}`
      throw new Error(msg)
    }
    return json as T
  }

  return {
    async createProject(name, dbPass) {
      const body = await mgmt<unknown>("/projects", {
        method: "POST",
        body: JSON.stringify({
          organization_slug: config.orgSlug,
          name,
          db_pass: dbPass,
          region_selection: { type: "smartGroup", code: config.regionGroup },
        }),
      })
      const ref = projectRefFromCreateBody(body)
      if (!ref) throw new Error("Management API create project did not return a ref")
      return { ref, name }
    },
    async listHealth(ref) {
      const rows = await mgmt<unknown>(`/projects/${ref}/health?services=auth,db,rest`)
      return Array.isArray(rows) ? (rows as HealthService[]) : []
    },
    async getApiKeys(ref) {
      const rows = await mgmt<unknown>(`/projects/${ref}/api-keys?reveal=true`)
      const keys = pickProjectApiKeys(rows)
      if (!keys) throw new Error("Management API did not return anon and service_role keys")
      return keys
    },
    async execSql(ref, sql) {
      await mgmt(`/projects/${ref}/database/query`, {
        method: "POST",
        body: JSON.stringify({ query: sql }),
      })
    },
  }
}
