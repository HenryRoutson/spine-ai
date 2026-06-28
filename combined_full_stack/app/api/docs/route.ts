// AI : TODO refactor (prod) — persist original bytes to Supabase Storage on upload, not local disk only.
import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { linkDocToProject, saveOriginalDocBytes } from "@/lib/server/store";
import { hashFileBytes, parserCacheKey, type ParserKind } from "@/lib/server/doc_text_cache";
import { logger } from "@/lib/server/server_logger";
import { confidentialUploadWarning } from "@/lib/confidential-upload";
import type { DocLabel, InputType, ProjectId } from "@/lib/server/types";

const apiLog = logger("api:docs");

const EXT_TYPE: Record<string, InputType> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  xls: "excel",
  xlsx: "excel",
  csv: "excel",
  json: "json",
  txt: "text",
  md: "text",
  html: "web",
  png: "image",
  jpg: "image",
  jpeg: "image",
};

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    apiLog.warn(`POST /api/docs — missing file`);
    return apiError("missing file", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return apiError(`file too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)`, 413);
  }
  const confidentialBlock = confidentialUploadWarning(file.name);
  if (confidentialBlock) {
    apiLog.warn(`POST /api/docs — confidential filename blocked`, { name: file.name });
    return apiError(confidentialBlock, 403);
  }
  const label = (form.get("label") as DocLabel) ?? "inference";
  const projectId = (form.get("projectId") as ProjectId | null) ?? undefined;
  const type = EXT_TYPE[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "text";
  apiLog.info(`POST /api/docs upload`, { name: file.name, type, label, sizeKb: Math.round(file.size / 1024) });

  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileHash = hashFileBytes(bytes);
  let parserKind: ParserKind | null = null;
  let parsedFresh = false;
  let content: string;

  try {
    if (type === "pdf") {
      parserKind = "pdfjs";
      const cached = store.parserCacheGetByFileHash(fileHash, parserKind);
      if (cached) {
        content = cached.content;
        apiLog.info(`parser cache HIT`, { name: file.name, parser: parserKind, fileHash });
      } else {
        apiLog.debug(`parsing PDF (built-in parser)`, { name: file.name });
        const { pdfBytesToText } = await import("@/lib/server/pdf_to_text");
        content = await pdfBytesToText(bytes);
        parsedFresh = true;
        apiLog.info(`PDF parsed (built-in)`, { name: file.name, chars: content.length });
      }
    } else if (type === "image") {
      // AI : images have no built-in parser text — vision OCR fills doc_vision_cache at run time.
      content = "";
    } else if (type === "excel") {
      parserKind = "plain";
      const cached = store.parserCacheGetByFileHash(fileHash, parserKind);
      if (cached) {
        content = cached.content;
        apiLog.info(`parser cache HIT`, { name: file.name, parser: parserKind, fileHash });
      } else {
        const { tabularBytesToContent } = await import("@/lib/server/tabular_parse");
        content = tabularBytesToContent(bytes, file.name).content;
        parsedFresh = true;
        apiLog.info(`tabular parsed`, { name: file.name, chars: content.length });
      }
    } else if (type === "json") {
      parserKind = "plain";
      const cached = store.parserCacheGetByFileHash(fileHash, parserKind);
      if (cached) {
        content = cached.content;
        apiLog.info(`parser cache HIT`, { name: file.name, parser: parserKind, fileHash });
      } else {
        const raw = new TextDecoder().decode(bytes);
        try {
          content = JSON.stringify(JSON.parse(raw), null, 2);
        } catch {
          content = raw;
        }
        parsedFresh = true;
      }
    } else {
      parserKind = "plain";
      const cached = store.parserCacheGetByFileHash(fileHash, parserKind);
      if (cached) {
        content = cached.content;
        apiLog.info(`parser cache HIT`, { name: file.name, parser: parserKind, fileHash });
      } else {
        content = new TextDecoder().decode(bytes);
        parsedFresh = true;
      }
    }
  } catch (err) {
    apiLog.error(`doc parse failed`, { name: file.name, error: (err as Error).message });
    return apiError(`could not parse ${file.name}: ${(err as Error).message}`, 422);
  }

  const doc = store.addDoc(file.name, type, content, label);
  if (parsedFresh && parserKind) {
    store.parserCacheSet({
      key: parserCacheKey(fileHash, parserKind),
      fileHash,
      docId: doc.id,
      parser: parserKind,
      content,
    });
    apiLog.info(`parser cache written`, { docId: doc.id, parser: parserKind, fileHash });
  }
  if (projectId) linkDocToProject(store, projectId, file.name);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (type === "pdf" || type === "image" || type === "excel" || type === "json") {
    saveOriginalDocBytes(doc.id, bytes, ext);
  }
  await store.flush();
  apiLog.info(`doc saved`, { docId: doc.id, name: file.name, label });
  return NextResponse.json(doc);
}
