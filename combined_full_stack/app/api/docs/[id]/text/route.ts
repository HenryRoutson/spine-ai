import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/app_store";
import type { DocId } from "@/lib/server/types";

// AI : real source text for the doc-viewer overlay (replaces the hardcoded LEGAL_SOURCE_TEXT).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = await getStore();
  const text = store.docContent(id as DocId);
  if (text === undefined) return NextResponse.json({ error: `unknown doc ${id}` }, { status: 404 });
  return NextResponse.json({ text });
}
