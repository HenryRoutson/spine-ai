import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { linkDocToProject, saveOriginalDocBytes } from "@/lib/server/store";
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

  const bytes = new Uint8Array(await file.arrayBuffer());
  let content: string;
  try {
    if (type === "pdf") {
      apiLog.debug(`parsing PDF`, { name: file.name });
      const { pdfBytesToText } = await import("@/lib/server/pdf_to_text");
      content = await pdfBytesToText(bytes);
      apiLog.info(`PDF parsed`, { name: file.name, chars: content.length });
    } else if (type === "image") {
      // AI : images need vision OCR at doc-to-text LLM step — no text at ingest.
      content = "";
    } else {
      content = new TextDecoder().decode(bytes);
    }
  } catch (err) {
    apiLog.error(`doc parse failed`, { name: file.name, error: (err as Error).message });
    return apiError(`could not parse ${file.name}: ${(err as Error).message}`, 422);
  }

  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;
  const doc = store.addDoc(file.name, type, content, label);
  if (projectId) linkDocToProject(store, projectId, file.name);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (type === "pdf" || type === "image") saveOriginalDocBytes(doc.id, bytes, ext);
  await store.flush();
  apiLog.info(`doc saved`, { docId: doc.id, name: file.name, label });
  return NextResponse.json(doc);
}
