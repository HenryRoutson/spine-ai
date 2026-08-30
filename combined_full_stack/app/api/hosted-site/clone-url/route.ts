import { NextResponse, type NextRequest } from "next/server"
import { apiError, requireAuthStore } from "@/lib/server/api_context"
import { parseRequestJson, hostedSiteCloneUrlBodySchema } from "@/lib/server/api_schemas"
import { HTTP } from "@/lib/server/api-errors"
import { cloneHostedSiteFromUrl, HostedSiteCloneError } from "@/lib/hosted-site-clone"
import { normalizeHostedSiteOptions } from "@/lib/hosted-site"

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore()
  if (ctx instanceof NextResponse) return ctx

  const body = await parseRequestJson(req, hostedSiteCloneUrlBodySchema)
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST)

  try {
    const result = await cloneHostedSiteFromUrl(body.url, normalizeHostedSiteOptions(body.siteOptions))
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof HostedSiteCloneError ? err.message : "Could not clone that page"
    const status = err instanceof HostedSiteCloneError ? HTTP.UNPROCESSABLE : HTTP.INTERNAL
    return apiError(message, status)
  }
}
