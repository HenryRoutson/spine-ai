import { NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { landingBuildPipelineBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import {
  LandingProxyAuthError,
  assertLandingProxyAllowed,
  clientIpForLandingDemo,
} from "@/lib/server/landing_proxy_auth";
import { landingDemoCorsHeaders } from "@/lib/server/landing_demo_cors";
import { LandingBudgetError } from "@/lib/server/landing_page_demo";
import { hasLandingPageSignup } from "@/lib/server/landing_page_signups";
import { buildLandingPipelineFromTask } from "@/lib/server/landing_pipeline_build";
import { logger } from "@/lib/server/server_logger";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const routeLog = logger("api/landing-demo/build-pipeline");

function jsonWithCors(req: Request, body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: landingDemoCorsHeaders(req) });
}

export async function OPTIONS(req: Request): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: landingDemoCorsHeaders(req) });
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    assertLandingProxyAllowed(req.headers);
  } catch (err) {
    if (err instanceof LandingProxyAuthError) {
      return jsonWithCors(req, { error: "unauthorized" }, HTTP.UNAUTHORIZED);
    }
    throw err;
  }

  const limited = await enforceIpRateLimit(req, "landing_demo_build");
  if (limited) {
    return NextResponse.json(await limited.json(), {
      status: limited.status,
      headers: { ...landingDemoCorsHeaders(req), ...Object.fromEntries(limited.headers.entries()) },
    });
  }

  const body = await parseRequestJson(req, landingBuildPipelineBodySchema);
  if ("validationError" in body) return jsonWithCors(req, { error: body.validationError }, HTTP.BAD_REQUEST);

  try {
    const registered = await hasLandingPageSignup(body.email);
    if (!registered) {
      return jsonWithCors(req, { error: "Enter your email before generating a pipeline.", code: "email_required" }, HTTP.BAD_REQUEST);
    }

    const ip = clientIpForLandingDemo(req.headers);
    const result = await buildLandingPipelineFromTask(body.task, ip);
    return jsonWithCors(req, result);
  } catch (err) {
    if (err instanceof LandingBudgetError) {
      return jsonWithCors(req, { error: err.message, code: err.code }, HTTP.UNAVAILABLE);
    }
    const message = err instanceof Error ? err.message : "Pipeline build failed";
    routeLog.warn("landing build failed", { error: message });
    return jsonWithCors(req, { error: message }, HTTP.BAD_REQUEST);
  }
}
