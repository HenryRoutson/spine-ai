import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { parseRequestJson, userBillingKeyIdSchema } from "@/lib/server/api_schemas";
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

export async function GET() {
  // AI : list is a cheap UI read — keep off the billing mutation bucket (20/min shared with balance polls).
  const ctx = await requireAuthStore("read");
  if (ctx instanceof NextResponse) return ctx;
  const keys = await listUserBillingKeys(ctx.auth.userId);
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore("billing");
  if (ctx instanceof NextResponse) return ctx;
  const parsed = await parseRequestJson(req, createKeyBodySchema, {});
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const created = await createUserBillingKey(ctx.auth.userId, parsed.label);
  apiLog.info(`created billing key`, { userId: ctx.auth.userId, id: created.id });
  return NextResponse.json({ key: created });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAuthStore("billing");
  if (ctx instanceof NextResponse) return ctx;
  const idRaw = req.nextUrl.searchParams.get("id");
  const parsed = userBillingKeyIdSchema.safeParse(idRaw);
  if (!parsed.success) return apiError("id required", HTTP.BAD_REQUEST);
  const ok = await revokeUserBillingKey(ctx.auth.userId, parsed.data as UserBillingKeyId);
  if (!ok) return apiError("key not found", 404);
  return NextResponse.json({ ok: true });
}
