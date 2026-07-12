import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownDoc } from "@/lib/server/api-errors";
import { originalDocFile, type Store } from "@/lib/server/store";
import type { DocId } from "@/lib/server/types";

// AI : the original file for the Documents-tab viewer — extracted text stays at /text.
// AI : TODO refactor (prod) — serve from Supabase Storage once Store persists upload bytes (see store.ts).
// AI : prod gap — bytes are not in Supabase; originalDocFile only finds local/seed files.
async function resolveOriginalDocFile(store: Store, id: DocId) {
  const docName = store.docs().find((d) => d.id === id)?.name;
  return originalDocFile(id, docName);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id } = await ctx.params;
  if (store.docContent(id as DocId) === undefined) {
    return apiError(unknownDoc(id), HTTP.NOT_FOUND);
  }
  const file = await resolveOriginalDocFile(store, id as DocId);
  if (!file) return apiError(`no original file for ${id}`, 404);
  // AI : SECURITY — attachment avoids inline PDF/JS execution in the browser; viewer can still fetch bytes.
  const disposition = file.mime === "application/pdf" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(readFileSync(file.path)), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": disposition,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function HEAD(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id } = await ctx.params;
  if (store.docContent(id as DocId) === undefined) {
    return apiError(unknownDoc(id), HTTP.NOT_FOUND);
  }
  const file = await resolveOriginalDocFile(store, id as DocId);
  if (!file) return apiError(`no original file for ${id}`, 404);
  const disposition = file.mime === "application/pdf" ? "attachment" : "inline";
  return new NextResponse(null, {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": disposition,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
