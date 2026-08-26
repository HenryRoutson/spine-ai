import { NextResponse, type NextRequest } from "next/server"
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context"
import { parseRequestJson, hostedSiteAssistantBodySchema } from "@/lib/server/api_schemas"
import { HTTP } from "@/lib/server/api-errors"
import {
  parseAssistantRequestModel,
  requireProjectOr404,
  trimAssistantHistory,
} from "@/lib/server/assistant-route"
import {
  gateAssistantBilling,
  recordAssistantBilling,
  HOSTED_SITE_ASSISTANT_BILLING_CHART_KEY,
} from "@/lib/server/assistant_billing"
import { ensureModelOptionsFresh } from "@/lib/server/openrouter_models"
import { proposeHostedSitePage } from "@/lib/server/hosted-site-assistant"
import { normalizeHostedSiteOptions } from "@/lib/hosted-site"
import { logger } from "@/lib/server/server_logger"
import type { ProjectId } from "@/lib/server/types"

const apiLog = logger("api:hosted-site-assistant")

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore("llm")
  if (ctx instanceof NextResponse) return ctx
  const { store } = ctx

  const body = await parseRequestJson(req, hostedSiteAssistantBodySchema)
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST)

  const modelOrErr = parseAssistantRequestModel(body.model)
  if (modelOrErr instanceof NextResponse) return modelOrErr
  const model = modelOrErr

  const projectOrErr = await requireProjectOr404(store, body.projectId as ProjectId, apiLog)
  if (projectOrErr instanceof NextResponse) return projectOrErr
  const project = projectOrErr

  let billingKey
  try {
    billingKey = await gateAssistantBilling()
  } catch (err) {
    const billed = billingResponse(err)
    if (billed) return billed
    throw err
  }

  apiLog.info(`POST /api/hosted-site-assistant`, {
    projectId: body.projectId,
    model,
    messageChars: body.message.length,
  })

  const startedAt = Date.now()
  try {
    await ensureModelOptionsFresh()
    const result = await proposeHostedSitePage(
      project,
      normalizeHostedSiteOptions(body.siteOptions),
      body.message,
      trimAssistantHistory(body.history ?? []),
      model,
    )
    let billedCents = 0
    if (result.usageCents > 0) {
      billedCents = await recordAssistantBilling(billingKey, {
        store,
        projectId: project.id,
        model,
        message: body.message,
        responseMessage: result.message,
        usageCents: result.usageCents,
        startedAt,
        chartKey: HOSTED_SITE_ASSISTANT_BILLING_CHART_KEY,
      })
    }
    return NextResponse.json({ ...result, billedCents })
  } catch (err) {
    apiLog.error(`hosted site assistant failed`, { projectId: body.projectId, error: (err as Error).message })
    return apiError((err as Error).message, HTTP.UNPROCESSABLE)
  }
}
