import { NextResponse } from "next/server"
import { HTTP } from "@/lib/server/api-errors"
import { apiError, enforceUserRateLimit } from "@/lib/server/api_context"
import { deleteAccountBodySchema, parseRequestJson } from "@/lib/server/api_schemas"
import { DeleteAccountError, deleteUserAccount } from "@/lib/server/delete_account"
import { isAuthSession, requireAuth } from "@/lib/server/require_auth"

export async function DELETE(req: Request) {
  const auth = await requireAuth()
  if (!isAuthSession(auth)) return auth

  const limited = await enforceUserRateLimit(auth.userId, "billing")
  if (limited) return limited

  const body = await parseRequestJson(req, deleteAccountBodySchema)
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST)

  try {
    await deleteUserAccount(auth.userId, auth.email, body.confirmEmail)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof DeleteAccountError) {
      const status =
        err.code === "unavailable"
          ? HTTP.UNAVAILABLE
          : err.code === "forbidden"
            ? HTTP.FORBIDDEN
            : HTTP.BAD_REQUEST
      return apiError(err.message, status, err.code)
    }
    return apiError(err instanceof Error ? err.message : "Failed to delete account", HTTP.BAD_REQUEST)
  }
}
