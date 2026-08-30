import { describe, expect, it } from "vitest"
import { ModuleKind, type ModuleId, type Project, type ProjectId, type StructureModelId } from "@/lib/types"
import { DEFAULT_HOSTED_SITE_OPTIONS, type HostedSiteAuth } from "@/lib/shared-link-types"
import { normalizeHostedSiteOptions } from "@/lib/hosted-site"
import {
  isolatedSiteAuthReady,
  markPendingIsolatedAlloc,
  mergePreservedSiteAlloc,
  websiteHasByoSupabase,
  websiteNeedsIsolatedSupabase,
} from "@/lib/website-supabase-need"

const jwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${"a".repeat(20)}.${"b".repeat(20)}`

const page = normalizeHostedSiteOptions({
  brand: { companyName: "Acme" },
  customHtml: "<h1>Hi</h1>",
})

describe("websiteNeedsIsolatedSupabase", () => {
  it("skips a static marketing page", () => {
    expect(websiteNeedsIsolatedSupabase(page)).toBe(false)
  })

  it("allocates when sign-in is enabled", () => {
    expect(
      websiteNeedsIsolatedSupabase({
        ...page,
        auth: { ...page.auth, enabled: true },
      }),
    ).toBe(true)
  })

  it("allocates for {{sql}} / {{action}} / {{table}} slots", () => {
    expect(websiteNeedsIsolatedSupabase({ ...page, customHtml: "{{sql:shared_number}}" })).toBe(true)
    expect(websiteNeedsIsolatedSupabase({ ...page, customHtml: "{{action:double}}" })).toBe(true)
    expect(websiteNeedsIsolatedSupabase({ ...page, customHtml: "{{table:Lead}}" })).toBe(true)
  })

  it("does not allocate for a {{run}} slot alone", () => {
    expect(websiteNeedsIsolatedSupabase({ ...page, customHtml: "<p>{{run}}</p>" })).toBe(false)
  })

  it("allocates when the snapshot has a SQL step", () => {
    const project = {
      id: "p1" as ProjectId,
      name: "Double",
      kind: "pipeline",
      models: [],
      modules: [
        {
          id: "mod_sql" as ModuleId,
          kind: ModuleKind.Sql,
          label: "Double",
          cached: false,
          avgMs: 0,
          avgCostCents: 0,
        },
      ],
      strategies: [],
    } as unknown as Project
    expect(websiteNeedsIsolatedSupabase(page, project)).toBe(true)
  })

  it("allocates when the snapshot has a user structure", () => {
    const project = {
      id: "p1" as ProjectId,
      name: "Leads",
      kind: "pipeline",
      models: [{ id: "m_lead" as StructureModelId, name: "Lead", fields: [], auto: false }],
      modules: [],
      strategies: [],
    } as unknown as Project
    expect(websiteNeedsIsolatedSupabase(page, project)).toBe(true)
  })
})

describe("websiteHasByoSupabase", () => {
  it("requires custom provider, valid keys, and no Spine projectRef", () => {
    const byo: HostedSiteAuth = {
      ...DEFAULT_HOSTED_SITE_OPTIONS.auth,
      provider: "custom_supabase",
      customSupabaseUrl: "https://abcd.supabase.co",
      customSupabaseAnonKey: jwt,
    }
    expect(websiteHasByoSupabase(byo)).toBe(true)
    expect(websiteHasByoSupabase({ ...byo, projectRef: "abcd" })).toBe(false)
    expect(websiteHasByoSupabase({ ...byo, provider: "spine" })).toBe(false)
  })
})

describe("mergePreservedSiteAlloc", () => {
  it("keeps a ready project's URL through a brand PATCH", () => {
    const prev: HostedSiteAuth = {
      ...DEFAULT_HOSTED_SITE_OPTIONS.auth,
      projectRef: "abcd",
      allocStatus: "ready",
      customSupabaseUrl: "https://abcd.supabase.co",
      customSupabaseAnonKey: jwt,
    }
    const next: HostedSiteAuth = { ...DEFAULT_HOSTED_SITE_OPTIONS.auth, enabled: true }
    const merged = mergePreservedSiteAlloc(prev, next)
    expect(merged.enabled).toBe(true)
    expect(merged.projectRef).toBe("abcd")
    expect(merged.allocStatus).toBe("ready")
    expect(merged.customSupabaseUrl).toBe("https://abcd.supabase.co")
  })
})

describe("markPendingIsolatedAlloc", () => {
  it("sets pending when the site needs a database", () => {
    const next = markPendingIsolatedAlloc({ ...page, customHtml: "{{sql:n}}" })
    expect(next.auth.allocStatus).toBe("pending")
  })

  it("leaves a static page idle", () => {
    expect(markPendingIsolatedAlloc(page).auth.allocStatus).toBe("idle")
  })

  it("does not overwrite ready", () => {
    const ready = {
      ...page,
      auth: { ...page.auth, allocStatus: "ready" as const, projectRef: "abcd" },
    }
    expect(markPendingIsolatedAlloc(ready).auth.allocStatus).toBe("ready")
  })
})

describe("isolatedSiteAuthReady", () => {
  it("requires ready + URL + anon", () => {
    expect(isolatedSiteAuthReady(DEFAULT_HOSTED_SITE_OPTIONS.auth)).toBe(false)
    expect(
      isolatedSiteAuthReady({
        ...DEFAULT_HOSTED_SITE_OPTIONS.auth,
        allocStatus: "ready",
        customSupabaseUrl: "https://abcd.supabase.co",
        customSupabaseAnonKey: jwt,
      }),
    ).toBe(true)
  })
})
