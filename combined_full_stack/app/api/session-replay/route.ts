import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { parseRequestJson, sessionReplayChunkBodySchema } from "@/lib/server/api_schemas";
import { isAuthSession, requireAuth } from "@/lib/server/require_auth";
import {
  ingestSessionReplayChunk,
  listSessionReplaysForUser,
  SessionReplayOwnershipError,
} from "@/lib/server/session_replay";
import type { session_id_string } from "@/lib/session-replay-types";
import { SESSION_REPLAY_ENABLED } from "@/lib/session-replay-enabled";

// AI : rrweb chunk ingest — disclosed in Privacy Policy for early-user ops debugging.
export async function POST(req: NextRequest) {
  // AI : kill switch is not an outage — 503 spammed the browser console on every flush.
  if (!SESSION_REPLAY_ENABLED) return NextResponse.json({ ok: true, disabled: true });

  const auth = await requireAuth();
  if (!isAuthSession(auth)) return auth;

  const body = await parseRequestJson(req, sessionReplayChunkBodySchema);
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST);

  const events = body.events ?? [];
  const hasMeta = (body.pages?.length ?? 0) > 0 || (body.clickedComponents?.length ?? 0) > 0;
  if (events.length === 0 && !body.isFinal && !hasMeta) {
    return apiError("events required unless isFinal", HTTP.BAD_REQUEST);
  }

  try {
    await ingestSessionReplayChunk({
      sessionId: body.sessionId as session_id_string,
      userId: auth.userId,
      userEmail: auth.email,
      projectId: body.projectId,
      chunkIndex: body.chunkIndex,
      events,
      isFinal: body.isFinal,
      pages: body.pages,
      clickedComponents: body.clickedComponents,
    });
  } catch (err) {
    if (err instanceof SessionReplayOwnershipError) {
      return apiError("session ownership mismatch", HTTP.FORBIDDEN);
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (!SESSION_REPLAY_ENABLED) return NextResponse.json({ sessions: [] });

  const auth = await requireAuth();
  if (!isAuthSession(auth)) return auth;

  const sessions = await listSessionReplaysForUser(auth.userId);
  return NextResponse.json({ sessions });
}
