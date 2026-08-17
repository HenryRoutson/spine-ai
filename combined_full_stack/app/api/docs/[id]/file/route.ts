import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownDoc } from "@/lib/server/api-errors";
import { originalDocMeta, resolveOriginalDocBytes, type Store } from "@/lib/server/store";
import { logger } from "@/lib/server/server_logger";
import { InputType, type DocId, type DocRef } from "@/lib/server/types";

const apiLog = logger("api:docs-file");

// AI : original PDF/image for the Documents-tab viewer — extracted text stays at /text.
function docFor(store: Store, id: DocId): DocRef | undefined {
  return store.docs().find((d) => d.id === id);
}

function expectsOriginalFile(doc: Pick<DocRef, "type"> | undefined): boolean {
  return doc?.type === InputType.Pdf || doc?.type === InputType.Image;
}

function logOriginalFileMiss(method: "GET" | "HEAD", docId: DocId, doc: DocRef | undefined): void {
  if (expectsOriginalFile(doc)) {
    apiLog.warn(`${method} /file 404 — original bytes missing`, {
      docId,
      name: doc?.name,
      type: doc?.type,
      hint: "re-upload the PDF/image so bytes land in Storage bucket doc-originals",
    });
    return;
  }
  apiLog.debug(`${method} /file 404 — no binary (expected for this type)`, {
    docId,
    name: doc?.name,
    type: doc?.type,
  });
}

function originalFileMissing(id: string, doc: DocRef | undefined) {
  const type = doc?.type ?? "unknown";
  const detail = expectsOriginalFile(doc)
    ? `Doc text exists in Supabase, but original ${type} bytes were not on disk, in bundled seeds, or in Storage bucket doc-originals. Re-upload the file.`
    : `No original binary for ${id} (type=${type}) — only PDF/image uploads are stored as files.`;
  return apiError(`no original file for ${id}`, HTTP.NOT_FOUND, "original_file_missing", {
    resource: `doc:${id}`,
    detail,
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id } = await ctx.params;
  const docId = id as DocId;
  const doc = docFor(store, docId);
  if (store.docContent(docId) === undefined) {
    apiLog.warn(`GET /file 404 — no doc text row`, { docId, name: doc?.name, type: doc?.type });
    return apiError(unknownDoc(id), HTTP.NOT_FOUND);
  }
  const file = await resolveOriginalDocBytes(store, docId, doc?.name);
  if (!file) {
    logOriginalFileMiss("GET", docId, doc);
    return originalFileMissing(id, doc);
  }
  apiLog.info(`GET /file served`, {
    docId,
    name: doc?.name,
    ext: file.ext,
    source: file.source,
    bytes: file.bytes.length,
  });
  // AI : SECURITY — attachment avoids inline PDF/JS execution in the browser; viewer can still fetch bytes.
  const disposition = file.mime === "application/pdf" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(file.bytes), {
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
  const docId = id as DocId;
  const doc = docFor(store, docId);
  if (store.docContent(docId) === undefined) {
    apiLog.warn(`HEAD /file 404 — no doc text row`, { docId, name: doc?.name, type: doc?.type });
    return apiError(unknownDoc(id), HTTP.NOT_FOUND);
  }
  const meta = await originalDocMeta(store, docId, doc?.name);
  if (!meta) {
    logOriginalFileMiss("HEAD", docId, doc);
    return originalFileMissing(id, doc);
  }
  apiLog.debug(`HEAD /file ok`, { docId, ext: meta.ext, source: meta.source });
  const disposition = meta.mime === "application/pdf" ? "attachment" : "inline";
  return new NextResponse(null, {
    headers: {
      "Content-Type": meta.mime,
      "Content-Disposition": disposition,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
