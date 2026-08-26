import { readFileSync } from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate_limit";
import type { RateLimitKey } from "@/lib/rate_limit_config";
import { apiError } from "@/lib/server/api_context";
import { HTTP, unknownDoc } from "@/lib/server/api-errors";
import { parseSharedLinkId } from "@/lib/server/api_schemas";
import { getSharedLink } from "@/lib/server/shared_links";
import { resolveSharedDocSessionForRequest } from "@/lib/server/shared-link-doc-session";
import { resolveSharedDocOriginalFile, parseSharedDocId, parseSharedSessionId, SHARED_RUN_SESSION_COOKIE } from "@/lib/server/shared-link-session";

async function sharedDocFileResponse(req: NextRequest, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId: rawDocId } = await ctx.params;
  const linkId = parseSharedLinkId(id);
  if (!linkId) return apiError("link not found", 404);

  const ip = clientIpFromHeaders(req.headers);
  const limitKey = `shared-doc-file:${linkId}:${ip}` as RateLimitKey;
  const limited = await checkRateLimit(limitKey, "read");
  if (!limited.ok) {
    return apiError("Too many document reads — try again later.", HTTP.TOO_MANY_REQUESTS, "rate_limited");
  }

  const link = await getSharedLink(linkId);
  if (!link) return apiError("link not found", 404);

  const jar = await cookies();
  const cookieSessionId = parseSharedSessionId(jar.get(SHARED_RUN_SESSION_COOKIE)?.value);
  const sessionId = await resolveSharedDocSessionForRequest(
    link,
    new URL(req.url).searchParams.get("sessionId"),
    cookieSessionId,
  );
  const docId = parseSharedDocId(rawDocId);
  if (!docId) return apiError(unknownDoc(rawDocId), HTTP.NOT_FOUND);
  const file = await resolveSharedDocOriginalFile(linkId, docId, sessionId, link.defaultDocs);
  if (!file) return apiError(unknownDoc(rawDocId), HTTP.NOT_FOUND);

  return { file, docId: rawDocId };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const resolved = await sharedDocFileResponse(req, ctx);
  if (resolved instanceof NextResponse) return resolved;
  const { file } = resolved;
  const body = file.bytes ?? (file.path ? new Uint8Array(readFileSync(file.path)) : null);
  if (!body) return apiError(unknownDoc(resolved.docId), HTTP.NOT_FOUND);
  // AI : SECURITY — attachment for PDFs; nosniff blocks MIME sniffing to script/html.
  const disposition = file.mime === "application/pdf" ? "attachment" : "inline";
  return new NextResponse(body, {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": disposition,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function HEAD(req: NextRequest, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const resolved = await sharedDocFileResponse(req, ctx);
  if (resolved instanceof NextResponse) return resolved;
  const { file } = resolved;
  const disposition = file.mime === "application/pdf" ? "attachment" : "inline";
  return new NextResponse(null, {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": disposition,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
