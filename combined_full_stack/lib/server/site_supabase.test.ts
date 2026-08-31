import { describe, expect, it } from "vitest"
import { DEFAULT_HOSTED_SITE_OPTIONS, type HostedSiteAuth, type HostedSiteOptions } from "@/lib/shared-link-types"
import type { Project, ProjectId } from "@/lib/types"
import {
  allocateSiteSupabase,
  APP_SQL_ROWS_BOOTSTRAP_SQL,
  type SiteAllocRecord,
  type SiteAllocStore,
} from "./site_supabase"
import type { HealthService, MgmtClient, ProjectApiKeys, supabase_project_ref } from "./supabase_mgmt"

const jwtAnon = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${"a".repeat(20)}.${"b".repeat(20)}`
const jwtRole = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${"c".repeat(20)}.${"d".repeat(20)}`

function siteOptions(partial: Partial<HostedSiteOptions> = {}): HostedSiteOptions {
  return {
    ...DEFAULT_HOSTED_SITE_OPTIONS,
    brand: { ...DEFAULT_HOSTED_SITE_OPTIONS.brand, companyName: "Acme" },
    customHtml: "{{sql:shared_number}}",
    ...partial,
  }
}

function record(auth: Partial<HostedSiteAuth> = {}): SiteAllocRecord {
  return {
    id: "site_abc123def456",
    siteOptions: siteOptions({ auth: { ...DEFAULT_HOSTED_SITE_OPTIONS.auth, ...auth } }),
    snapshot: {
      id: "" as ProjectId,
      name: "Acme",
      kind: "page",
      models: [],
      modules: [],
      strategies: [],
    },
  }
}

function memoryStore(initial: SiteAllocRecord): SiteAllocStore & { row: SiteAllocRecord } {
  const box = { row: initial }
  return {
    get row() {
      return box.row
    },
    get: async () => box.row,
    patch: async (_id, auth, secrets) => {
      box.row = {
        ...box.row,
        siteOptions: { ...box.row.siteOptions, auth: { ...box.row.siteOptions.auth, ...auth } },
        hostedSiteSecrets: secrets === null ? undefined : secrets ?? box.row.hostedSiteSecrets,
      }
    },
  }
}

function mockMgmt(opts?: { healthFirst?: HealthService[] }): MgmtClient & { sql: string[] } {
  const sql: string[] = []
  let healthCalls = 0
  return {
    sql,
    createProject: async (name) => ({ ref: "newprojref123456" as supabase_project_ref, name }),
    listHealth: async () => {
      healthCalls += 1
      if (opts?.healthFirst && healthCalls === 1) return opts.healthFirst
      return [
        { name: "auth", status: "ACTIVE_HEALTHY" },
        { name: "db", status: "ACTIVE_HEALTHY" },
        { name: "rest", status: "ACTIVE_HEALTHY" },
      ]
    },
    getApiKeys: async (): Promise<ProjectApiKeys> => ({ anonKey: jwtAnon, serviceRoleKey: jwtRole }),
    execSql: async (_ref, statement) => {
      sql.push(statement)
    },
  }
}

describe("allocateSiteSupabase", () => {
  it("creates a project, waits for health, stores public keys and service role separately", async () => {
    const store = memoryStore(record({ allocStatus: "pending" }))
    const mgmt = mockMgmt()
    const auth = await allocateSiteSupabase(store.row.id, {
      store,
      mgmt,
      sleep: async () => {},
      healthTimeoutMs: 1,
      healthPollMs: 0,
    })
    expect(auth.allocStatus).toBe("ready")
    expect(auth.projectRef).toBe("newprojref123456")
    expect(auth.customSupabaseUrl).toBe("https://newprojref123456.supabase.co")
    expect(auth.customSupabaseAnonKey).toBe(jwtAnon)
    expect(store.row.hostedSiteSecrets?.serviceRoleKey).toBe(jwtRole)
    expect(JSON.stringify(auth)).not.toContain(jwtRole)
    expect(mgmt.sql.some((s) => /app_sql_rows/i.test(s))).toBe(true)
    expect(APP_SQL_ROWS_BOOTSTRAP_SQL.length).toBeGreaterThan(0)
  })

  it("skips create when a projectRef already exists", async () => {
    const store = memoryStore(record({ allocStatus: "pending", projectRef: "alreadyref123456" }))
    let created = 0
    const mgmt = mockMgmt()
    const wrapped: MgmtClient = {
      ...mgmt,
      createProject: async (name) => {
        created += 1
        return mgmt.createProject(name, "x")
      },
    }
    const auth = await allocateSiteSupabase(store.row.id, {
      store,
      mgmt: wrapped,
      sleep: async () => {},
      healthTimeoutMs: 1,
      healthPollMs: 0,
    })
    expect(created).toBe(0)
    expect(auth.projectRef).toBe("alreadyref123456")
    expect(auth.allocStatus).toBe("ready")
  })

  it("records a missing management token instead of using Spine prod", async () => {
    const prevToken = process.env.SUPABASE_ACCESS_TOKEN
    const prevOrg = process.env.SUPABASE_ORG_SLUG
    delete process.env.SUPABASE_ACCESS_TOKEN
    delete process.env.SUPABASE_ORG_SLUG
    const store = memoryStore(record({ allocStatus: "pending" }))
    try {
      const auth = await allocateSiteSupabase(store.row.id, { store, sleep: async () => {} })
      expect(auth.allocStatus).toBe("error")
      expect(auth.allocError).toMatch(/SUPABASE_ACCESS_TOKEN/)
    } finally {
      if (prevToken === undefined) delete process.env.SUPABASE_ACCESS_TOKEN
      else process.env.SUPABASE_ACCESS_TOKEN = prevToken
      if (prevOrg === undefined) delete process.env.SUPABASE_ORG_SLUG
      else process.env.SUPABASE_ORG_SLUG = prevOrg
    }
  })
})
