import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownDoc } from "@/lib/server/api-errors";
import { pdfFilePath } from "@/lib/server/store";
import type { DocId } from "@/lib/server/types";

// AI : the original PDF for the Documents-tab viewer — extracted text stays at /text.
// AI : prod gap — bytes are not in Supabase; pdfFilePath only finds local/seed files (see savePdfBytes TODO).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id } = await ctx.params;
  if (store.docContent(id as DocId) === undefined) {
    return apiError(unknownDoc(id), HTTP.NOT_FOUND);
  }
  const path = await pdfFilePath(id as DocId);
  // AI : expected for user-uploaded PDFs on Vercel/Supabase until Storage backfill lands.
  if (!path) return apiError(`no pdf file for ${id}`, 404);
  return new NextResponse(new Uint8Array(readFileSync(path)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline" },
  });
}
