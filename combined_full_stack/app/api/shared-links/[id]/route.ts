import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { parseRequestJson, parseSharedLinkId, updateDeploymentBodySchema } from "@/lib/server/api_schemas";
import {
  getSharedLink,
  publicLinkView,
  revokeSharedLink,
  setSharedLinkEnabled,
  SharedLinkSpendLimitTooLowError,
  updateSharedLinkSpendLimit,
} from "@/lib/server/shared_links";

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

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { id } = await ctx.params;
  const linkId = parseSharedLinkId(id);
  if (!linkId) return apiError("link not found", 404);

  const parsed = await parseRequestJson(req, updateDeploymentBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, 400);

  let result: Awaited<ReturnType<typeof setSharedLinkEnabled>> = null;

  // AI : validate spend limit before toggling enabled so PATCH stays atomic.
  if (parsed.spendLimitCents !== undefined) {
    try {
      result = await updateSharedLinkSpendLimit(
        authCtx.auth.userId,
        linkId,
        parsed.spendLimitCents,
      );
      if (!result) return apiError("link not found", 404);
    } catch (err) {
      if (err instanceof SharedLinkSpendLimitTooLowError) {
        return apiError(err.message, 400, "spend_limit_too_low");
      }
      throw err;
    }
  }

  if (parsed.enabled !== undefined) {
    result = await setSharedLinkEnabled(authCtx.auth.userId, linkId, parsed.enabled);
    if (!result) return apiError("link not found", 404);
  }

  if (!result) return apiError("link not found", 404);
  return NextResponse.json({ link: result });
}
