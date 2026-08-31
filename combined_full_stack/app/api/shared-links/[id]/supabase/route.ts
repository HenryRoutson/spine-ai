import { NextResponse, type NextRequest } from "next/server"
import { apiError, requireAuthStore } from "@/lib/server/api_context"
import { HTTP } from "@/lib/server/api-errors"
import { parseSharedLinkId } from "@/lib/server/api_schemas"
import { getSharedLink } from "@/lib/server/shared_links"
import { allocateSiteSupabase } from "@/lib/server/site_supabase"
import { isSiteLinkId } from "@/lib/hosted-site"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore()
  if (authCtx instanceof NextResponse) return authCtx
  const { id } = await ctx.params
  const linkId = parseSharedLinkId(id)
  if (!linkId) return apiError("link not found", 404)
  const link = await getSharedLink(linkId)
  if (!link || link.ownerId !== authCtx.auth.userId) return apiError("link not found", 404)
  if (!isSiteLinkId(link.id)) return apiError("only hosted websites have an isolated Supabase", 400)
  return NextResponse.json({
    auth: link.siteOptions.auth,
    hasServiceRole: Boolean(link.hostedSiteSecrets?.serviceRoleKey),
  })
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore("write")
  if (authCtx instanceof NextResponse) return authCtx
  const { id } = await ctx.params
  const linkId = parseSharedLinkId(id)
  if (!linkId) return apiError("link not found", 404)
  const link = await getSharedLink(linkId)
  if (!link || link.ownerId !== authCtx.auth.userId) return apiError("link not found", 404)
  if (!isSiteLinkId(link.id)) return apiError("only hosted websites have an isolated Supabase", 400)
  const auth = await allocateSiteSupabase(link.id)
  return NextResponse.json({ auth, hasServiceRole: auth.allocStatus === "ready" })
}
