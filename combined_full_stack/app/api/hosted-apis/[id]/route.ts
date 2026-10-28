import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { parseHostedApiId, parseRequestJson, updateDeploymentBodySchema } from "@/lib/server/api_schemas";
import {
  getHostedApi,
  HostedApiSpendLimitTooLowError,
  revokeHostedApi,
  setHostedApiEnabled,
  updateHostedApiSpendLimit,
} from "@/lib/server/hosted_apis";

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

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { id } = await ctx.params;
  const apiId = parseHostedApiId(id);
  if (!apiId) return apiError("api not found", 404);

  const parsed = await parseRequestJson(req, updateDeploymentBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, 400);

  let result: Awaited<ReturnType<typeof setHostedApiEnabled>> = null;

  // AI : validate spend limit before toggling enabled so PATCH stays atomic.
  if (parsed.spendLimitCents !== undefined) {
    try {
      result = await updateHostedApiSpendLimit(
        authCtx.auth.userId,
        apiId,
        parsed.spendLimitCents,
      );
      if (!result) return apiError("api not found", 404);
    } catch (err) {
      if (err instanceof HostedApiSpendLimitTooLowError) {
        return apiError(err.message, 400, "spend_limit_too_low");
      }
      throw err;
    }
  }

  if (parsed.enabled !== undefined) {
    result = await setHostedApiEnabled(authCtx.auth.userId, apiId, parsed.enabled);
    if (!result) return apiError("api not found", 404);
  }

  if (!result) return apiError("api not found", 404);
  return NextResponse.json({ api: result });
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
      enabled: api.enabled,
      revoked: api.revoked,
    },
  });
}
