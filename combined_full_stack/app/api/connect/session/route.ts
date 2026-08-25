import { NextResponse } from "next/server"
import { HTTP } from "@/lib/server/api-errors"
import { apiError, requireAuthStore } from "@/lib/server/api_context"
import { connectSessionBodySchema, parseRequestJson } from "@/lib/server/api_schemas"
import { getConnectAction, type connect_action_id_string } from "@/lib/connect-catalog"
import { createNangoConnectSession, nangoConfigured } from "@/lib/server/nango_client"
import { logger } from "@/lib/server/server_logger"

const apiLog = logger("api:connect")

export async function POST(req: Request) {
  const ctx = await requireAuthStore("write")
  if (ctx instanceof NextResponse) return ctx

  const parsed = await parseRequestJson(req, connectSessionBodySchema)
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST)

  const entry = getConnectAction(parsed.actionId)
  if (!entry) return apiError(`unknown connect action: ${parsed.actionId}`, HTTP.BAD_REQUEST)
  if (entry.auth === "none") {
    return apiError(`${entry.displayName} does not need an account connection`, HTTP.BAD_REQUEST)
  }
  if (!nangoConfigured()) {
    return apiError("NANGO_SECRET_KEY is not set — self-host Nango next to Spine", HTTP.BAD_REQUEST)
  }

  try {
    const session = await createNangoConnectSession({
      endUserId: ctx.auth.userId,
      actionId: parsed.actionId as connect_action_id_string,
    })
    apiLog.info("connect session", { provider: session.provider, actionId: parsed.actionId })
    return NextResponse.json({
      sessionToken: session.sessionToken,
      host: session.host,
      provider: session.provider,
      actionId: parsed.actionId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start connect session"
    return apiError(message, HTTP.BAD_REQUEST)
  }
}
