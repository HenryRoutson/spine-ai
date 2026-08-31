// AI : BYO Supabase for a hosted site — validate keys and pack schema.sql. Isolated alloc is lib/server/site_supabase.ts.
import { allModelsToSql } from "@/lib/sql-schema"
import { sqlTableName } from "@/lib/sql-id-types"
import { stripSharedModels } from "@/lib/server/builtin_models"
import type { PipelineModule, StructureModel } from "@/lib/types"

export type supabase_project_url = string & { __brand: "supabase_project_url" }
export type supabase_anon_key = string & { __brand: "supabase_anon_key" }

const SUPABASE_URL_RE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i
const LOCAL_SUPABASE_URL_RE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i
const ANON_KEY_RE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export function parseSupabaseProjectUrl(raw: string): supabase_project_url | null {
  const v = raw.trim()
  if (!v) return null
  if (SUPABASE_URL_RE.test(v) || LOCAL_SUPABASE_URL_RE.test(v)) {
    return v.replace(/\/$/, "") as supabase_project_url
  }
  return null
}

export function parseSupabaseAnonKey(raw: string): supabase_anon_key | null {
  const v = raw.trim()
  if (v.length < 40) return null
  return ANON_KEY_RE.test(v) ? (v as supabase_anon_key) : null
}

export type schema_pack = {
  filename: string
  sql: string
  tables: string[]
}

export function schemaPackForModels(
  models: StructureModel[],
  modules: PipelineModule[] = [],
): schema_pack {
  const userModels = stripSharedModels(models)
  return {
    filename: "schema.sql",
    sql: allModelsToSql(models, modules),
    tables: userModels.map((m) => sqlTableName(m.name)),
  }
}

export function supabaseConnectSummary(url: string, anonKey: string): string {
  const parsedUrl = parseSupabaseProjectUrl(url)
  const parsedKey = parseSupabaseAnonKey(anonKey)
  if (parsedUrl && parsedKey) return `Connected · ${parsedUrl}`
  if (parsedUrl && !parsedKey) return "URL looks valid — paste the anon (publishable) key"
  if (!parsedUrl && parsedKey) return "Key looks valid — paste https://YOUR_PROJECT.supabase.co"
  return "Paste a Supabase project URL and anon key to store these tables"
}
