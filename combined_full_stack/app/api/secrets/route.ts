import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { parseRequestJson, secretNameSchema, upsertSecretBodySchema } from "@/lib/server/api_schemas";
import { deleteUserSecret, listUserSecrets, upsertUserSecret } from "@/lib/server/user_secrets";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:secrets");

export async function GET() {
  const ctx = await requireAuthStore("read");
  if (ctx instanceof NextResponse) return ctx;
  const secrets = await listUserSecrets(ctx.auth.userId);
  return NextResponse.json({ secrets });
}

export async function PUT(req: NextRequest) {
  const ctx = await requireAuthStore("write");
  if (ctx instanceof NextResponse) return ctx;
  const parsed = await parseRequestJson(req, upsertSecretBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  try {
    const secret = await upsertUserSecret(ctx.auth.userId, parsed.name, parsed.value);
    apiLog.info(`upsert secret`, { userId: ctx.auth.userId, name: secret.name });
    return NextResponse.json({ secret });
  } catch (err) {
    return apiError((err as Error).message, HTTP.BAD_REQUEST);
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAuthStore("write");
  if (ctx instanceof NextResponse) return ctx;
  const parsed = secretNameSchema.safeParse(req.nextUrl.searchParams.get("name") ?? "");
  if (!parsed.success) return apiError("name required", HTTP.BAD_REQUEST);
  const ok = await deleteUserSecret(ctx.auth.userId, parsed.data);
  if (!ok) return apiError("secret not found", 404);
  return NextResponse.json({ ok: true });
}