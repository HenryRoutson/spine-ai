import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownDoc } from "@/lib/server/api-errors";
import type { DocId } from "@/lib/server/types";

// AI : parser text = docs.content / {id}.txt (built-in PDF.js). Vision OCR is a separate layer.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id } = await ctx.params;
  const docId = id as DocId;
  if (store.docContent(docId) === undefined) {
    return apiError(unknownDoc(id), HTTP.NOT_FOUND);
  }

  const layer = new URL(req.url).searchParams.get("layer") ?? "parser";
  if (layer === "vision") {
    const entries = store.visionCachesForDoc(docId).map((row) => ({
      key: row.key,
      model: row.model,
      prompt: row.prompt,
      purpose: row.purpose,
      text: row.content,
      createdAt: row.createdAt,
      chars: row.content.length,
    }));
    return NextResponse.json({ layer: "vision", entries });
  }

  const text = store.docContent(docId)!;
  const parserRow = store.parserCacheGetByDoc(docId);
  return NextResponse.json({
    layer: "parser",
    text,
    parser: parserRow?.parser,
    fromCache: !!parserRow,
    fileHash: parserRow?.fileHash,
    cacheKey: parserRow?.key,
    cachedAt: parserRow?.createdAt,
  });
}
