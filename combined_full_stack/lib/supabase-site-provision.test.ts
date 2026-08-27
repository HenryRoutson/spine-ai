import { describe, expect, it } from "vitest"
import {
  parseSupabaseAnonKey,
  parseSupabaseProjectUrl,
  schemaPackForModels,
  supabaseConnectSummary,
} from "@/lib/supabase-site-provision"
import { FieldType, type StructureModel, type StructureModelId } from "@/lib/types"

const model: StructureModel = {
  id: "m_lead" as StructureModelId,
  name: "Lead",
  description: "A row",
  fields: [{ id: "f_name", name: "name", type: FieldType.Text, optional: false, description: "Name" }],
}

describe("BYO Supabase provision", () => {
  it("accepts hosted and local project URLs", () => {
    expect(parseSupabaseProjectUrl("https://abcd.supabase.co")).toBe("https://abcd.supabase.co")
    expect(parseSupabaseProjectUrl("https://abcd.supabase.co/")).toBe("https://abcd.supabase.co")
    expect(parseSupabaseProjectUrl("http://127.0.0.1:54321")).toBe("http://127.0.0.1:54321")
    expect(parseSupabaseProjectUrl("https://evil.example")).toBeNull()
  })

  it("requires a JWT-shaped anon key", () => {
    const key = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${"a".repeat(20)}.${"b".repeat(20)}`
    expect(parseSupabaseAnonKey(key)).toBe(key)
    expect(parseSupabaseAnonKey("not-a-jwt")).toBeNull()
  })

  it("packs schema.sql from structure models", () => {
    const pack = schemaPackForModels([model])
    expect(pack.filename).toBe("schema.sql")
    expect(pack.tables).toContain("lead")
    expect(pack.sql.toLowerCase()).toContain("create table")
  })

  it("summarizes connect progress", () => {
    expect(supabaseConnectSummary("", "")).toMatch(/paste a supabase project url/i)
    expect(supabaseConnectSummary("https://abcd.supabase.co", "")).toMatch(/anon/i)
  })
})
