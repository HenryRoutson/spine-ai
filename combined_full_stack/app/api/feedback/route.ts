import { NextResponse } from "next/server";
import { HTTP } from "@/lib/server/api-errors";
import { apiError, enforceUserRateLimit } from "@/lib/server/api_context";
import { feedbackBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { FeedbackCreditError, grantFeedbackCredit } from "@/lib/server/feedback_credit";
import { isAuthSession, requireAuth } from "@/lib/server/require_auth";
import { saveUserFeedback } from "@/lib/server/user_feedback";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!isAuthSession(auth)) return auth;

  const limited = await enforceUserRateLimit(auth.userId, "feedback");
  if (limited) return limited;

  const body = await parseRequestJson(req, feedbackBodySchema);
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST);

  try {
    const entry = await saveUserFeedback(auth, body.message);
    const credit = await grantFeedbackCredit(auth.userId, entry.id, body.message.trim().length);
    return NextResponse.json({
      id: entry.id,
      createdAt: entry.createdAt,
      creditedCents: credit.creditedCents,
      balanceCents: credit.balanceCents,
      creditsRemainingToday: credit.creditsRemainingToday,
    });
  } catch (err) {
    if (err instanceof FeedbackCreditError) {
      return apiError(err.message, HTTP.BAD_REQUEST, err.code);
    }
    const message = err instanceof Error ? err.message : "Failed to save feedback";
    return apiError(message, HTTP.BAD_REQUEST);
  }
}
