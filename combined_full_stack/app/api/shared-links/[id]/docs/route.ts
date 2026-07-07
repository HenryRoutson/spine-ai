import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate_limit";
import type { RateLimitKey } from "@/lib/rate_limit_config";
import { apiError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { parseSharedLinkId } from "@/lib/server/api_schemas";
import {
  inputTypeFromFilename,
  parseUploadedBytes,
  validateUploadBytes,
  validateUploadFile,
} from "@/lib/server/doc_upload_parse";
import { isMultiDocInputModule, orderedInputModules } from "@/lib/inference-input";
import { getSharedLink, newSessionId } from "@/lib/server/shared_links";
import {
  MAX_SHARED_SESSION_BYTES,
  MAX_SHARED_SESSION_DOCS,
  parseSharedSessionId,
  saveSessionUpload,
  sessionUploadBytes,
  sessionUploadCount,
} from "@/lib/server/shared-link-session";
import { secureSessionCookieOptions } from "@/lib/server/cookie_options";
import type { ModuleId } from "@/lib/server/types";

const SESSION_COOKIE = "shared_run_session";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const linkId = parseSharedLinkId(id);
  if (!linkId) return apiError("link not found", 404);

  const ip = clientIpFromHeaders(req.headers);
  const uploadLimitKey = `shared-upload:${linkId}:${ip}` as RateLimitKey;
  const uploadLimited = await checkRateLimit(uploadLimitKey, "shared_upload");
  if (!uploadLimited.ok) {
    return apiError("Too many uploads — try again later.", HTTP.TOO_MANY_REQUESTS, "rate_limited");
  }

  const link = await getSharedLink(linkId);
  if (!link) return apiError("link not found", 404);

  const form = await req.formData();
  const file = form.get("file");
  const moduleId = form.get("moduleId") as ModuleId | null;
  if (!(file instanceof File) || !moduleId) return apiError("file and moduleId required", 400);
  if (!orderedInputModules(link.snapshot.modules).some((m) => m.id === moduleId)) {
    return apiError("invalid moduleId", HTTP.BAD_REQUEST);
  }
  const uploadErr = validateUploadFile(file);
  if (uploadErr) return apiError(uploadErr.message, uploadErr.status);

  const jar = await cookies();
  let sessionId = parseSharedSessionId(jar.get(SESSION_COOKIE)?.value) ?? newSessionId();
  if (sessionUploadCount(link.id, sessionId) >= MAX_SHARED_SESSION_DOCS) {
    return apiError(`session upload limit reached (max ${MAX_SHARED_SESSION_DOCS} files)`, HTTP.BAD_REQUEST);
  }
  const type = inputTypeFromFilename(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (sessionUploadBytes(link.id, sessionId) + bytes.byteLength > MAX_SHARED_SESSION_BYTES) {
    return apiError("session storage limit reached", HTTP.BAD_REQUEST);
  }
  const bytesErr = validateUploadBytes(bytes, file.name, type);
  if (bytesErr) return apiError(bytesErr.message, bytesErr.status);
  let parsed;
  try {
    parsed = await parseUploadedBytes(bytes, file.name, type);
  } catch (err) {
    return apiError(`could not parse ${file.name}: ${(err as Error).message}`, 422);
  }

  const inputModule = orderedInputModules(link.snapshot.modules).find((m) => m.id === moduleId);
  const doc = await saveSessionUpload(
    link.id,
    sessionId,
    moduleId,
    file,
    parsed.content,
    type,
    bytes,
    inputModule ? isMultiDocInputModule(inputModule) : false,
  );
  const res = NextResponse.json(doc);
  res.cookies.set(SESSION_COOKIE, sessionId, secureSessionCookieOptions(60 * 60 * 24 * 30));
  return res;
}
