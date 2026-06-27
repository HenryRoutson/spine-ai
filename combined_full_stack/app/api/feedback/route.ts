import { NextResponse } from "next/server";
import { apiError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { isAuthSession, requireAuth } from "@/lib/server/require_auth";
import { saveUserFeedback } from "@/lib/server/user_feedback";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!isAuthSession(auth)) return auth;

  let body: { message?: string };
  try {
    body = (await req.json()) as { message?: string };
  } catch {
    return apiError("Invalid JSON body", HTTP.BAD_REQUEST);
  }

  try {
    const entry = await saveUserFeedback(auth, String(body.message ?? ""));
    return NextResponse.json({
      id: entry.id,
      createdAt: entry.createdAt,
      userId: entry.userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save feedback";
    return apiError(message, HTTP.BAD_REQUEST);
  }
}
