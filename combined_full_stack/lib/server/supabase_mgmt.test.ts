import { describe, expect, it, vi } from "vitest"
import {
  createSupabaseMgmt,
  generateSupabaseDbPassword,
  pickProjectApiKeys,
  projectNameForSite,
  projectRefFromCreateBody,
  readSupabaseMgmtConfig,
  servicesAreHealthy,
} from "./supabase_mgmt"

describe("readSupabaseMgmtConfig", () => {
  it("requires token and org slug", () => {
    const missing = readSupabaseMgmtConfig({})
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.error).toMatch(/SUPABASE_ACCESS_TOKEN/)
  })

  it("reads org + region group", () => {
    const ok = readSupabaseMgmtConfig({
      SUPABASE_ACCESS_TOKEN: "sbp_test",
      SUPABASE_ORG_SLUG: "acme",
      SUPABASE_REGION_GROUP: "emea",
    })
    expect(ok).toEqual({
      ok: true,
      config: { token: "sbp_test", orgSlug: "acme", regionGroup: "emea" },
    })
  })
})

describe("pickProjectApiKeys", () => {
  it("accepts legacy anon / service_role names", () => {
    expect(
      pickProjectApiKeys([
        { name: "anon", api_key: "anon-jwt" },
        { name: "service_role", api_key: "role-jwt" },
      ]),
    ).toEqual({ anonKey: "anon-jwt", serviceRoleKey: "role-jwt" })
  })

  it("accepts publishable / secret types", () => {
    expect(
      pickProjectApiKeys([
        { type: "publishable", api_key: "pub" },
        { type: "secret", api_key: "sec" },
      ]),
    ).toEqual({ anonKey: "pub", serviceRoleKey: "sec" })
  })
})

describe("project helpers", () => {
  it("names a project from the site id", () => {
    expect(projectNameForSite("site_e6d0565d51af44028d120645")).toMatch(/^spine-/)
    expect(projectNameForSite("site_e6d0565d51af44028d120645").length).toBeLessThanOrEqual(32)
  })

  it("reads the ref from create responses", () => {
    expect(projectRefFromCreateBody({ id: "abcdefghijklmnop" })).toBe("abcdefghijklmnop")
  })

  it("requires auth, db, and rest healthy", () => {
    expect(
      servicesAreHealthy([
        { name: "auth", status: "ACTIVE_HEALTHY" },
        { name: "db", status: "ACTIVE_HEALTHY" },
        { name: "rest", status: "ACTIVE_HEALTHY" },
      ]),
    ).toBe(true)
    expect(
      servicesAreHealthy([
        { name: "auth", status: "ACTIVE_HEALTHY" },
        { name: "db", status: "COMING_UP" },
        { name: "rest", status: "ACTIVE_HEALTHY" },
      ]),
    ).toBe(false)
  })

  it("generates a password that satisfies complexity", () => {
    const pass = generateSupabaseDbPassword()
    expect(pass.startsWith("Sp1!")).toBe(true)
    expect(pass.length).toBeGreaterThan(12)
  })
})

describe("createSupabaseMgmt", () => {
  it("POSTs a project without desired_instance_size", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.supabase.com/v1/projects")
      expect(init?.method).toBe("POST")
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(body.organization_slug).toBe("acme")
      expect(body).not.toHaveProperty("desired_instance_size")
      expect(body.region_selection).toEqual({ type: "smartGroup", code: "americas" })
      return new Response(JSON.stringify({ id: "projref12345678" }), { status: 201 })
    }) as unknown as typeof fetch
    const mgmt = createSupabaseMgmt(
      { token: "sbp_x", orgSlug: "acme", regionGroup: "americas" },
      fetchImpl,
    )
    const created = await mgmt.createProject("spine-abc", "Sp1!pass")
    expect(created.ref).toBe("projref12345678")
  })
})
