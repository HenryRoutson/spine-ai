import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { parseHostedApiId } from "@/lib/server/api_schemas";
import { getHostedApi, revokeHostedApi } from "@/lib/server/hosted_apis";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { id } = await ctx.params;
  const apiId = parseHostedApiId(id);
  if (!apiId) return apiError("api not found", 404);
  const ok = await revokeHostedApi(authCtx.auth.userId, apiId);
  if (!ok) return apiError("api not found", 404);
  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { id } = await ctx.params;
  const apiId = parseHostedApiId(id);
  if (!apiId) return apiError("api not found", 404);
  const api = await getHostedApi(apiId);
  if (!api || api.ownerId !== authCtx.auth.userId) return apiError("api not found", 404);
  return NextResponse.json({
    api: {
      id: api.id,
      projectId: api.projectId,
      name: api.name,
      defaultModel: api.defaultModel,
      apiKeyPrefix: api.apiKeyPrefix,
      spendLimitCents: api.spendLimitCents,
      totalSpendCents: api.totalSpendCents,
      requestCount: api.requestCount,
      createdAt: api.createdAt,
      revoked: api.revoked,
    },
  });
}
