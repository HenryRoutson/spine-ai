// AI : allocate one Supabase Cloud project per website that has backend logic — never mutate Spine prod schema.
import { isSiteLinkId } from "@/lib/hosted-site"
import type { HostedSiteAuth, HostedSiteOptions } from "@/lib/shared-link-types"
import type { Project, SharedLinkId } from "@/lib/types"
import {
  isolatedSiteAuthReady,
  websiteHasByoSupabase,
  websiteNeedsIsolatedSupabase,
} from "@/lib/website-supabase-need"
import { logger } from "./server_logger"
import type { HostedSiteSecrets } from "./shared-link-persist"
import { createRemoteAdminClient } from "./supabase_admin"
import {
  createSupabaseMgmt,
  generateSupabaseDbPassword,
  projectNameForSite,
  readSupabaseMgmtConfig,
  servicesAreHealthy,
  type MgmtClient,
  type supabase_project_ref,
} from "./supabase_mgmt"

const log = logger("site-supabase")

export const APP_SQL_ROWS_BOOTSTRAP_SQL = [
  `create table if not exists public.app_sql_rows (
  scope text not null,
  table_name text not null,
  row_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (scope, table_name, row_id)
)`,
  `alter table public.app_sql_rows enable row level security`,
  `grant all on public.app_sql_rows to service_role`,
] as const

export type SiteAllocRecord = {
  id: string
  siteOptions: HostedSiteOptions
  snapshot: Project
  hostedSiteSecrets?: HostedSiteSecrets
}

export type SiteAllocStore = {
  get: (id: string) => Promise<SiteAllocRecord | null>
  patch: (id: string, auth: Partial<HostedSiteAuth>, secrets?: HostedSiteSecrets | null) => Promise<void>
}

export type AllocDeps = {
  store?: SiteAllocStore
  mgmt?: MgmtClient
  sleep?: (ms: number) => Promise<void>
  healthTimeoutMs?: number
  healthPollMs?: number
  now?: () => number
  dbPassword?: string
}

const inflight = new Map<string, Promise<HostedSiteAuth>>()

async function defaultStore(): Promise<SiteAllocStore> {
  const { getSharedLink, patchSiteSupabaseState } = await import("./shared_links")
  return {
    get: async (id) => getSharedLink(id as SharedLinkId),
    patch: async (id, auth, secrets) => {
      await patchSiteSupabaseState(id as SharedLinkId, auth, secrets)
    },
  }
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitUntilHealthy(
  mgmt: MgmtClient,
  ref: supabase_project_ref,
  deps: AllocDeps,
): Promise<void> {
  const timeoutMs = deps.healthTimeoutMs ?? 180_000
  const pollMs = deps.healthPollMs ?? 5_000
  const sleep = deps.sleep ?? sleepMs
  const now = deps.now ?? Date.now
  const deadline = now() + timeoutMs
  for (;;) {
    const rows = await mgmt.listHealth(ref)
    if (servicesAreHealthy(rows)) return
    if (now() >= deadline) throw new Error("Timed out waiting for the new Supabase project to become healthy")
    await sleep(pollMs)
  }
}

export function siteAdminClientForLink(link: SiteAllocRecord): ReturnType<typeof createRemoteAdminClient> | null {
  const url = link.siteOptions.auth.customSupabaseUrl.trim()
  const key = link.hostedSiteSecrets?.serviceRoleKey?.trim() ?? ""
  if (!url || !key || link.siteOptions.auth.allocStatus !== "ready") return null
  return createRemoteAdminClient(url, key)
}

export async function allocateSiteSupabase(linkId: string, deps: AllocDeps = {}): Promise<HostedSiteAuth> {
  const existing = inflight.get(linkId)
  if (existing) return existing
  const run = allocateSiteSupabaseOnce(linkId, deps).finally(() => inflight.delete(linkId))
  inflight.set(linkId, run)
  return run
}

async function allocateSiteSupabaseOnce(linkId: string, deps: AllocDeps): Promise<HostedSiteAuth> {
  const store = deps.store ?? (await defaultStore())
  const link = await store.get(linkId)
  if (!link || !isSiteLinkId(link.id)) {
    throw new Error("only hosted websites can allocate an isolated Supabase")
  }
  const auth = link.siteOptions.auth
  if (auth.allocStatus === "ready" && isolatedSiteAuthReady(auth) && link.hostedSiteSecrets?.serviceRoleKey) {
    return auth
  }
  if (websiteHasByoSupabase(auth) && !auth.projectRef) {
    await store.patch(linkId, { allocStatus: "skipped", allocError: "" })
    return { ...auth, allocStatus: "skipped", allocError: "" }
  }
  if (!websiteNeedsIsolatedSupabase(link.siteOptions, link.snapshot) && !auth.projectRef) {
    return auth
  }

  let mgmt = deps.mgmt
  if (!mgmt) {
    const cfg = readSupabaseMgmtConfig()
    if (!cfg.ok) {
      await store.patch(linkId, { allocStatus: "error", allocError: cfg.error })
      return { ...auth, allocStatus: "error", allocError: cfg.error }
    }
    mgmt = createSupabaseMgmt(cfg.config)
  }
  try {
    await store.patch(linkId, { allocStatus: "pending", allocError: "" })
    let ref = (auth.projectRef.trim() || "") as supabase_project_ref
    if (!ref) {
      const created = await mgmt.createProject(
        projectNameForSite(link.id),
        deps.dbPassword ?? generateSupabaseDbPassword(),
      )
      ref = created.ref
      await store.patch(linkId, { projectRef: ref, allocStatus: "pending", allocError: "" })
    }
    await waitUntilHealthy(mgmt, ref, deps)
    const keys = await mgmt.getApiKeys(ref)
    const url = `https://${ref}.supabase.co`
    for (const sql of APP_SQL_ROWS_BOOTSTRAP_SQL) {
      await mgmt.execSql(ref, sql)
    }
    const publicAuth: Partial<HostedSiteAuth> = {
      projectRef: ref,
      allocStatus: "ready",
      allocError: "",
      customSupabaseUrl: url,
      customSupabaseAnonKey: keys.anonKey,
    }
    await store.patch(linkId, publicAuth, { serviceRoleKey: keys.serviceRoleKey })
    log.info("allocated isolated supabase", { linkId, projectRef: ref })
    return { ...auth, ...publicAuth }
  } catch (err) {
    const message = (err as Error).message || "failed to allocate isolated Supabase"
    log.error("alloc failed", { linkId, error: message })
    await store.patch(linkId, { allocStatus: "error", allocError: message })
    return { ...auth, allocStatus: "error", allocError: message }
  }
}
