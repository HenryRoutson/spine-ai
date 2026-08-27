import { NextResponse, type NextRequest } from "next/server"
import { apiError, requireAuthStore } from "@/lib/server/api_context"
import { parseRequestJson, hostedSiteCompileBodySchema } from "@/lib/server/api_schemas"
import { HTTP } from "@/lib/server/api-errors"
import { compileHostedSiteReactProject } from "@/lib/hosted-site-react-compile"
import { normalizeHostedSiteReactFiles } from "@/lib/hosted-site-react"
import { normalizeHostedSiteOptions } from "@/lib/hosted-site"

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore()
  if (ctx instanceof NextResponse) return ctx

  const body = await parseRequestJson(req, hostedSiteCompileBodySchema)
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST)

  const result = compileHostedSiteReactProject(
    normalizeHostedSiteReactFiles(body.files),
    body.brand ? normalizeHostedSiteOptions({ brand: body.brand }) : undefined,
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
  return NextResponse.json(result.bundle)
}
