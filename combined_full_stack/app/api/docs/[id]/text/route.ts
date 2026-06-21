import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import type { DocId } from "@/lib/server/types";

// AI : real source text for the doc-viewer overlay (replaces the hardcoded LEGAL_SOURCE_TEXT).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id } = await ctx.params;
  const text = store.docContent(id as DocId);
  if (text === undefined) return apiError(`unknown doc ${id}`, 404);
  return NextResponse.json({ text });
}
