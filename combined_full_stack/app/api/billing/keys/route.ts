import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, requireAuthStore, storeAuthError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { parseRequestJson, userBillingKeyIdSchema } from "@/lib/server/api_schemas";
import { isUpstreamFetchError } from "@/lib/server/errors";
import { isExpectedAuthSkewError } from "@/lib/server/supabase_store";
import {
  createUserBillingKey,
  listUserBillingKeys,
  revokeUserBillingKey,
  type UserBillingKeyId,
} from "@/lib/server/user_billing_keys";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:billing:keys");

const createKeyBodySchema = z
  .object({
    label: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

function keysUnavailable(err: unknown, op: string): NextResponse | null {
  if (isUpstreamFetchError(err) || isExpectedAuthSkewError(err)) {
    apiLog.warn(`${op} temporarily unavailable`);
    return apiError("Billing keys temporarily unavailable — retry shortly.", HTTP.UNAVAILABLE);
  }
  return null;
}

export async function GET() {
  // AI : list is a cheap UI read — keep off the billing mutation bucket (20/min shared with balance polls).
  const ctx = await requireAuthStore("read");
  if (ctx instanceof NextResponse) return ctx;
  try {
    const keys = await listUserBillingKeys(ctx.auth.userId);
    return NextResponse.json({ keys });
  } catch (err) {
    return keysUnavailable(err, "GET /api/billing/keys") ?? storeAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore("billing");
  if (ctx instanceof NextResponse) return ctx;
  const parsed = await parseRequestJson(req, createKeyBodySchema, {});
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  try {
    const created = await createUserBillingKey(ctx.auth.userId, parsed.label);
    apiLog.info(`created billing key`, { userId: ctx.auth.userId, id: created.id });
    return NextResponse.json({ key: created });
  } catch (err) {
    return keysUnavailable(err, "POST /api/billing/keys") ?? storeAuthError(err);
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAuthStore("billing");
  if (ctx instanceof NextResponse) return ctx;
  const idRaw = req.nextUrl.searchParams.get("id");
  const parsed = userBillingKeyIdSchema.safeParse(idRaw);
  if (!parsed.success) return apiError("id required", HTTP.BAD_REQUEST);
  try {
    const ok = await revokeUserBillingKey(ctx.auth.userId, parsed.data as UserBillingKeyId);
    if (!ok) return apiError("key not found", 404);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return keysUnavailable(err, "DELETE /api/billing/keys") ?? storeAuthError(err);
  }
}
