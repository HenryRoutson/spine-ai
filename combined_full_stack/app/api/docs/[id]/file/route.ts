import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { pdfFilePath } from "@/lib/server/store";
import type { DocId } from "@/lib/server/types";

// AI : the original PDF for the Documents-tab viewer — extracted text stays at /text.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id } = await ctx.params;
  if (store.docContent(id as DocId) === undefined) {
    return apiError(`unknown doc ${id}`, 404);
  }
  const path = await pdfFilePath(id as DocId);
  if (!path) return apiError(`no pdf file for ${id}`, 404);
  return new NextResponse(new Uint8Array(readFileSync(path)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline" },
  });
}
