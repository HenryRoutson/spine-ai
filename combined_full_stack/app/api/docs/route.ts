// AI : TODO refactor (prod) — persist original bytes to Supabase Storage on upload, not local disk only.
import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import {
  inputTypeFromFilename,
  parseUploadedBytes,
  validateUploadBytes,
  validateUploadFile,
  writeParserCacheIfFresh,
  shouldSaveOriginalBytes,
} from "@/lib/server/doc_upload_parse";
import { linkDocToProject, saveOriginalDocBytes } from "@/lib/server/store";
import { logger } from "@/lib/server/server_logger";
import { DocLabel } from "@/lib/server/types";
import type { ProjectId } from "@/lib/server/types";

const apiLog = logger("api:docs");

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const uploadErr = validateUploadFile(file instanceof File ? file : null);
  if (uploadErr) {
    if (uploadErr.status === 400) apiLog.warn(`POST /api/docs — missing file`);
    if (uploadErr.status === 403 && file instanceof File) {
      apiLog.warn(`POST /api/docs — confidential filename blocked`, { name: file.name });
    }
    return apiError(uploadErr.message, uploadErr.status);
  }
  const uploadFile = file as File;
  const label = (form.get("label") as DocLabel | null) ?? DocLabel.Inference;
  const projectId = (form.get("projectId") as ProjectId | null) ?? undefined;
  const type = inputTypeFromFilename(uploadFile.name);
  apiLog.info(`POST /api/docs upload`, {
    name: uploadFile.name,
    type,
    label,
    sizeKb: Math.round(uploadFile.size / 1024),
  });

  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const bytes = new Uint8Array(await uploadFile.arrayBuffer());
  const bytesErr = validateUploadBytes(bytes, uploadFile.name, type);
  if (bytesErr) return apiError(bytesErr.message, bytesErr.status);
  let parsed;
  try {
    parsed = await parseUploadedBytes(bytes, uploadFile.name, type, store);
    if (!parsed.parsedFresh && parsed.parserKind) {
      apiLog.info(`parser cache HIT`, {
        name: uploadFile.name,
        parser: parsed.parserKind,
        fileHash: parsed.fileHash,
      });
    } else if (parsed.parsedFresh && type === "pdf") {
      apiLog.info(`PDF parsed (built-in)`, { name: uploadFile.name, chars: parsed.content.length });
    } else if (parsed.parsedFresh && type === "excel") {
      apiLog.info(`tabular parsed`, { name: uploadFile.name, chars: parsed.content.length });
    }
  } catch (err) {
    apiLog.error(`doc parse failed`, { name: uploadFile.name, error: (err as Error).message });
    return apiError(`could not parse ${uploadFile.name}: ${(err as Error).message}`, 422);
  }

  const doc = store.addDoc(uploadFile.name, type, parsed.content, label);
  writeParserCacheIfFresh(store, parsed, doc.id);
  if (parsed.parsedFresh && parsed.parserKind) {
    apiLog.info(`parser cache written`, {
      docId: doc.id,
      parser: parsed.parserKind,
      fileHash: parsed.fileHash,
    });
  }
  if (projectId) linkDocToProject(store, projectId, uploadFile.name);
  const ext = uploadFile.name.split(".").pop()?.toLowerCase() ?? "";
  if (shouldSaveOriginalBytes(type)) {
    saveOriginalDocBytes(doc.id, bytes, ext);
  }
  await store.flush();
  apiLog.info(`doc saved`, { docId: doc.id, name: uploadFile.name, label });
  return NextResponse.json(doc);
}
