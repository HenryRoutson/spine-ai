import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { apiError } from "@/lib/server/api_context";
import { confidentialUploadWarning } from "@/lib/confidential-upload";
import { hashFileBytes, parserCacheKey, type ParserKind } from "@/lib/server/doc_text_cache";
import { getSharedLink, newSessionId, saveSessionUpload } from "@/lib/server/shared_links";
import type { InputType, ModuleId, SharedLinkId } from "@/lib/server/types";

const SESSION_COOKIE = "shared_run_session";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

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

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: linkId } = await ctx.params;
  const link = await getSharedLink(linkId as SharedLinkId);
  if (!link) return apiError("link not found", 404);

  const form = await req.formData();
  const file = form.get("file");
  const moduleId = form.get("moduleId") as ModuleId | null;
  if (!(file instanceof File) || !moduleId) return apiError("file and moduleId required", 400);
  if (file.size > MAX_UPLOAD_BYTES) {
    return apiError(`file too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)`, 413);
  }
  const confidentialBlock = confidentialUploadWarning(file.name);
  if (confidentialBlock) return apiError(confidentialBlock, 403);

  const jar = await cookies();
  let sessionId = jar.get(SESSION_COOKIE)?.value ?? newSessionId();
  const type = EXT_TYPE[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "text";
  const bytes = new Uint8Array(await file.arrayBuffer());
  let content: string;

  if (type === "pdf") {
    const { pdfBytesToText } = await import("@/lib/server/pdf_to_text");
    content = await pdfBytesToText(bytes);
  } else if (type === "image") {
    content = "";
  } else {
    content = new TextDecoder().decode(bytes);
  }

  const doc = await saveSessionUpload(link.id, sessionId, moduleId, file, content, type);
  const res = NextResponse.json(doc);
  res.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
