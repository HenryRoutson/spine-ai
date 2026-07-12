import { NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { landingSessionReplayChunkBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import {
  LandingProxyAuthError,
  assertLandingProxyAllowed,
  clientIpForLandingDemo,
} from "@/lib/server/landing_proxy_auth";
import { landingDemoCorsHeaders } from "@/lib/server/landing_demo_cors";
import { hasLandingPageSignup, hashLandingDemoIp } from "@/lib/server/landing_page_signups";
import { ingestLandingSessionReplayChunk, SessionReplayOwnershipError } from "@/lib/server/session_replay";
import { SESSION_REPLAY_ENABLED } from "@/lib/session-replay-enabled";
import type { session_id_string } from "@/lib/session-replay-types";

export const dynamic = "force-dynamic";

function jsonWithCors(req: Request, body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: landingDemoCorsHeaders(req) });
}

export async function OPTIONS(req: Request): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: landingDemoCorsHeaders(req) });
}

// AI : rrweb chunk ingest for anonymous landing visitors (email-gated, proxy-auth outside local-dev).
export async function POST(req: Request): Promise<NextResponse> {
  if (!SESSION_REPLAY_ENABLED) {
    return jsonWithCors(req, { error: "Session replay is disabled" }, HTTP.UNAVAILABLE);
  }

  try {
    assertLandingProxyAllowed(req.headers);
  } catch (err) {
    if (err instanceof LandingProxyAuthError) {
      return jsonWithCors(req, { error: "unauthorized" }, HTTP.UNAUTHORIZED);
    }
    throw err;
  }

  const limited = await enforceIpRateLimit(req, "landing_demo_replay");
  if (limited) {
    return NextResponse.json(await limited.json(), {
      status: limited.status,
      headers: { ...landingDemoCorsHeaders(req), ...Object.fromEntries(limited.headers.entries()) },
    });
  }

  const body = await parseRequestJson(req, landingSessionReplayChunkBodySchema);
  if ("validationError" in body) return jsonWithCors(req, { error: body.validationError }, HTTP.BAD_REQUEST);

  const events = body.events ?? [];
  const hasMeta = (body.pages?.length ?? 0) > 0 || (body.clickedComponents?.length ?? 0) > 0;
  if (events.length === 0 && !body.isFinal && !hasMeta) {
    return jsonWithCors(req, { error: "events required unless isFinal" }, HTTP.BAD_REQUEST);
  }

  const registered = await hasLandingPageSignup(body.email);
  if (!registered) {
    return jsonWithCors(req, { error: "email_required" }, HTTP.BAD_REQUEST);
  }

  const ip = clientIpForLandingDemo(req.headers);
  try {
    await ingestLandingSessionReplayChunk({
      sessionId: body.sessionId as session_id_string,
      demoEmail: body.email.trim().toLowerCase(),
      ipHash: hashLandingDemoIp(ip),
      projectId: body.projectId,
      chunkIndex: body.chunkIndex,
      events,
      isFinal: body.isFinal,
      pages: body.pages,
      clickedComponents: body.clickedComponents,
    });
  } catch (err) {
    if (err instanceof SessionReplayOwnershipError) {
      return jsonWithCors(req, { error: "session ownership mismatch" }, HTTP.FORBIDDEN);
    }
    throw err;
  }

  return jsonWithCors(req, { ok: true });
}
