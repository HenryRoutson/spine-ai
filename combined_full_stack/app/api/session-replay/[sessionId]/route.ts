import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { isAuthSession, requireAuth } from "@/lib/server/require_auth";
import { fetchSessionReplayEvents, listSessionReplaysForUser } from "@/lib/server/session_replay";
import type { session_id_string } from "@/lib/session-replay-types";
import { SESSION_REPLAY_ENABLED } from "@/lib/session-replay-enabled";

type route_ctx = { params: Promise<{ sessionId: string }> };

export async function GET(_req: NextRequest, ctx: route_ctx) {
  if (!SESSION_REPLAY_ENABLED) return apiError("Session replay is disabled", HTTP.UNAVAILABLE);

  const auth = await requireAuth();
  if (!isAuthSession(auth)) return auth;

  const { sessionId } = await ctx.params;
  const owned = await listSessionReplaysForUser(auth.userId, 500);
  if (!owned.some((s) => s.id === sessionId)) {
    return apiError("Session not found", HTTP.NOT_FOUND);
  }

  const events = await fetchSessionReplayEvents(sessionId as session_id_string);
  return NextResponse.json({ sessionId, events });
}
