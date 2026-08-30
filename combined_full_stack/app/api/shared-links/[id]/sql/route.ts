import { NextResponse, type NextRequest } from "next/server"
import { apiError } from "@/lib/server/api_context"
import { HTTP } from "@/lib/server/api-errors"
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate_limit"
import type { RateLimitKey } from "@/lib/rate_limit_config"
import { parseSharedLinkId } from "@/lib/server/api_schemas"
import { getSharedLink } from "@/lib/server/shared_links"
import { appSqlScopeForSite, sqlSeedRowsOf, tableNameForModel } from "@/lib/app-sql"
import { AppSqlUnavailableError, ensureAppSqlSeed, listAppSqlRows } from "@/lib/server/app_sql"
import { siteAdminClientForLink } from "@/lib/server/site_supabase"
import { isSiteLinkId } from "@/lib/hosted-site"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { storedFunctionsOnProject } from "@/lib/pipeline-functions"
import { pkFieldOf } from "@/lib/sql-id-types"
import { ModuleKind } from "@/lib/server/types"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const linkId = parseSharedLinkId(id)
  if (!linkId) return apiError("link not found", 404)

  const ip = clientIpFromHeaders(req.headers)
  const limited = await checkRateLimit(`shared-sql:${linkId}:${ip}` as RateLimitKey, "read")
  if (!limited.ok) return apiError("Too many reads — try again later.", HTTP.TOO_MANY_REQUESTS, "rate_limited")

  const link = await getSharedLink(linkId)
  if (!link) return apiError("link not found", 404)

  const table = (req.nextUrl.searchParams.get("table") ?? "").trim()
  if (!/^[a-z][a-z0-9_]*$/i.test(table)) return apiError("table required", 400)

  const scope = appSqlScopeForSite(link.id)
  const db = siteAdminClientForLink(link)
  if (isSiteLinkId(link.id) && !db && link.siteOptions.auth.allocStatus === "pending") {
    return apiError(
      "This website's isolated Supabase is still provisioning. Retry in a minute.",
      HTTP.UNAVAILABLE,
      "app_sql_unavailable",
    )
  }
  if (isSiteLinkId(link.id) && !db && link.siteOptions.auth.allocStatus === "error") {
    return apiError(
      link.siteOptions.auth.allocError || "Isolated Supabase allocation failed.",
      HTTP.UNAVAILABLE,
      "app_sql_unavailable",
    )
  }
  const sqlMods = storedFunctionsOnProject(link.snapshot).flatMap((fn) => flattenPipelineModules(fn.modules))
  const sqlMod = sqlMods.find((m) => {
    if (m.kind !== ModuleKind.Sql) return false
    const out = link.snapshot.models.find((model) => model.id === m.outStructureId)
    return out ? tableNameForModel(out) === table : false
  })
  const model = sqlMod
    ? link.snapshot.models.find((row) => row.id === sqlMod.outStructureId)
    : link.snapshot.models.find((row) => tableNameForModel(row) === table)
  const pkField = model ? pkFieldOf(model)?.name ?? "id" : "id"
  const seedRows = sqlMod ? sqlSeedRowsOf(sqlMod) : []
  try {
    const rows = await ensureAppSqlSeed(scope, table, seedRows, pkField, db)
    const listed = rows.length ? rows : await listAppSqlRows(scope, table, db)
    return NextResponse.json({ table, rows: listed })
  } catch (err) {
    if (err instanceof AppSqlUnavailableError) {
      return apiError(err.message, HTTP.UNAVAILABLE, err.code)
    }
    throw err
  }
}
