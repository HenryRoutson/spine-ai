import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownDoc } from "@/lib/server/api-errors";
import { originalDocFile } from "@/lib/server/store";
import type { DocId } from "@/lib/server/types";

// AI : the original file for the Documents-tab viewer — extracted text stays at /text.
// AI : prod gap — bytes are not in Supabase; originalDocFile only finds local/seed files.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id } = await ctx.params;
  if (store.docContent(id as DocId) === undefined) {
    return apiError(unknownDoc(id), HTTP.NOT_FOUND);
  }
  const file = await originalDocFile(id as DocId);
  if (!file) return apiError(`no original file for ${id}`, 404);
  return new NextResponse(new Uint8Array(readFileSync(file.path)), {
    headers: { "Content-Type": file.mime, "Content-Disposition": "inline" },
  });
}
