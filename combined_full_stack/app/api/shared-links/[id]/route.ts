import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { parseSharedLinkId } from "@/lib/server/api_schemas";
import { getSharedLink, publicLinkView, revokeSharedLink } from "@/lib/server/shared_links";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const linkId = parseSharedLinkId(id);
  if (!linkId) return apiError("link not found", 404);
  const link = await getSharedLink(linkId);
  if (!link) return apiError("link not found", 404);
  return NextResponse.json({ link: publicLinkView(link) });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { id } = await ctx.params;
  const linkId = parseSharedLinkId(id);
  if (!linkId) return apiError("link not found", 404);
  const ok = await revokeSharedLink(authCtx.auth.userId, linkId);
  if (!ok) return apiError("link not found", 404);
  return NextResponse.json({ ok: true });
}
