import { NextResponse, type NextRequest } from "next/server"
import { apiError, enforceIpRateLimit } from "@/lib/server/api_context"
import { HTTP, unknownProject } from "@/lib/server/api-errors"
import { parseRequestJson, runBodySchema } from "@/lib/server/api_schemas"
import { verifyLandingBuildAccessToken } from "@/lib/server/landing_build_access"
import { runDemoProject } from "@/lib/server/demo_pipeline_run"
import { UnknownModelError, parseOptionalRequestModel } from "@/lib/server/model_catalog"
import type { DocId, ModelId, ModuleId, ProjectId } from "@/lib/server/types"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const limited = await enforceIpRateLimit(req, "public")
  if (limited) return limited

  const parsed = await parseRequestJson(req, runBodySchema)
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST)

  const buildId = req.nextUrl.searchParams.get("buildId")
  const accessToken = req.nextUrl.searchParams.get("accessToken")
  if (buildId && !verifyLandingBuildAccessToken(buildId, accessToken)) {
    return apiError("invalid or missing build access token", HTTP.FORBIDDEN)
  }

  let model: ModelId | undefined
  try {
    model = parseOptionalRequestModel(parsed.model)
  } catch (err) {
    if (err instanceof UnknownModelError) return apiError(err.message, HTTP.BAD_REQUEST)
    throw err
  }

  try {
    const run = await runDemoProject({
      projectId: parsed.projectId as ProjectId,
      inputDocId: parsed.inputDocId as DocId,
      inputDocIds: parsed.inputDocIds as DocId[] | undefined,
      inputDocsByModule: parsed.inputDocsByModule as Partial<Record<ModuleId, DocId[]>> | undefined,
      model,
      buildId,
    })
    return NextResponse.json({ jobId: run.id, run })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.startsWith("unknown project")) return apiError(unknownProject(parsed.projectId), HTTP.NOT_FOUND)
    return apiError(message, HTTP.BAD_REQUEST)
  }
}
