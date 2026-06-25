import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { getStepCacheEntryDetail } from "@/lib/server/step_cache";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { auth, store } = authCtx;

  const { key: rawKey } = await ctx.params;
  const key = decodeURIComponent(rawKey);
  const entry = getStepCacheEntryDetail({
    cacheOwnerId: auth.userId,
    projects: store.projects(),
    key,
  });
  if (!entry) return apiError(`unknown cache entry ${key}`, 404);
  return NextResponse.json({ entry });
}
