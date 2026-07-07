import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate_limit";
import type { RateLimitKey } from "@/lib/rate_limit_config";
import { apiError } from "@/lib/server/api_context";
import { HTTP, unknownDoc } from "@/lib/server/api-errors";
import { parseSharedLinkId } from "@/lib/server/api_schemas";
import { getSharedLink } from "@/lib/server/shared_links";
import { resolveSharedDocParserText } from "@/lib/server/shared-link-session";
import type { DocId } from "@/lib/server/types";

const SESSION_COOKIE = "shared_run_session";

// AI : unauthenticated parser text for shared-link session + default docs.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId: rawDocId } = await ctx.params;
  const linkId = parseSharedLinkId(id);
  if (!linkId) return apiError("link not found", 404);

  const ip = clientIpFromHeaders(req.headers);
  const limitKey = `shared-doc-read:${linkId}:${ip}` as RateLimitKey;
  const limited = await checkRateLimit(limitKey, "read");
  if (!limited.ok) {
    return apiError("Too many document reads — try again later.", HTTP.TOO_MANY_REQUESTS, "rate_limited");
  }

  const link = await getSharedLink(linkId);
  if (!link) return apiError("link not found", 404);

  const layer = new URL(req.url).searchParams.get("layer") ?? "parser";
  if (layer !== "parser") {
    return NextResponse.json({ layer: "vision", entries: [] });
  }

  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  const docId = rawDocId as DocId;
  const text = resolveSharedDocParserText(linkId, docId, sessionId, link.defaultDocs);
  if (text === undefined) return apiError(unknownDoc(rawDocId), HTTP.NOT_FOUND);

  return NextResponse.json({
    layer: "parser",
    text,
    parser: "shared-link",
    fromCache: true,
  });
}
