import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { pdfFilePath } from "@/lib/server/store";
import type { DocId } from "@/lib/server/types";

// AI : the original PDF for the Documents-tab viewer — extracted text stays at /text.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const path = await pdfFilePath(id as DocId);
  if (!path) return NextResponse.json({ error: `no pdf file for ${id}` }, { status: 404 });
  return new NextResponse(new Uint8Array(readFileSync(path)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline" },
  });
}
