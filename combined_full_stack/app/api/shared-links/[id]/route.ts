import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { getSharedLink, publicLinkView, revokeSharedLink } from "@/lib/server/shared_links";
import type { SharedLinkId } from "@/lib/server/types";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const link = await getSharedLink(id as SharedLinkId);
  if (!link) return apiError("link not found", 404);
  return NextResponse.json({ link: publicLinkView(link) });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { id } = await ctx.params;
  const ok = await revokeSharedLink(authCtx.auth.userId, id as SharedLinkId);
  if (!ok) return apiError("link not found", 404);
  return NextResponse.json({ ok: true });
}
