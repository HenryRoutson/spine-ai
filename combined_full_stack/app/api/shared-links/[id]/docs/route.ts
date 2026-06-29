import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { apiError } from "@/lib/server/api_context";
import {
  inputTypeFromFilename,
  parseUploadedBytes,
  validateUploadFile,
} from "@/lib/server/doc_upload_parse";
import { getSharedLink, newSessionId } from "@/lib/server/shared_links";
import { saveSessionUpload } from "@/lib/server/shared-link-session";
import type { ModuleId, SharedLinkId } from "@/lib/server/types";

const SESSION_COOKIE = "shared_run_session";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: linkId } = await ctx.params;
  const link = await getSharedLink(linkId as SharedLinkId);
  if (!link) return apiError("link not found", 404);

  const form = await req.formData();
  const file = form.get("file");
  const moduleId = form.get("moduleId") as ModuleId | null;
  if (!(file instanceof File) || !moduleId) return apiError("file and moduleId required", 400);
  const uploadErr = validateUploadFile(file);
  if (uploadErr) return apiError(uploadErr.message, uploadErr.status);

  const jar = await cookies();
  let sessionId = jar.get(SESSION_COOKIE)?.value ?? newSessionId();
  const type = inputTypeFromFilename(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseUploadedBytes(bytes, file.name, type);
  } catch (err) {
    return apiError(`could not parse ${file.name}: ${(err as Error).message}`, 422);
  }

  const doc = await saveSessionUpload(link.id, sessionId, moduleId, file, parsed.content, type, bytes);
  const res = NextResponse.json(doc);
  res.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
