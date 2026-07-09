import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { activityBatchBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { isAuthSession, requireAuth } from "@/lib/server/require_auth";
import { recordActivityEvents } from "@/lib/server/user_activity";

// AI : client-side UI telemetry for early-user ops dashboard — disclosed in Privacy Policy.
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthSession(auth)) return auth;

  const body = await parseRequestJson(req, activityBatchBodySchema);
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST);

  // AI : SECURITY — never persist client-supplied costCents (billing/telemetry integrity).
  await recordActivityEvents(
    body.events.map((e) => ({
      userId: auth.userId,
      userEmail: auth.email,
      category: e.category,
      action: e.action,
      detail: e.detail,
      projectId: e.projectId,
    })),
  );

  return NextResponse.json({ ok: true });
}
